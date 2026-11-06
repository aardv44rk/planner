use std::collections::HashMap;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;
use anyhow::{anyhow, Result};
use chrono::{DateTime, Datelike, NaiveDate, Utc};
use ical::IcalParser;
use regex::Regex;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tokio::sync::Semaphore;

use super::client::{get_authenticated_client, LMS_BASE, LMS_MY_PAGE};
use crate::models::{Assignment, Course};

pub const CALENDAR_EXPORT_URL: &str =
    "https://lms.s.isct.ac.jp/2025/calendar/export_execute.php?preset_what=all&preset_time=recentupcoming";

const PALETTE: &[&str] = &[
    "#2f5fd0", // Cobalt
    "#8a5a0b", // Amber / Gold
    "#24733f", // Emerald / Forest
    "#b3382b", // Crimson
    "#6a3db5", // Purple
    "#007a78", // Teal
    "#c05621", // Bronze / Orange
    "#3182ce", // Indigo
];

#[derive(Debug, Clone)]
pub struct ParsedCalendarEvent {
    pub uid: String,
    pub summary: String,
    pub description: String,
    pub start_date: String,
    pub start_time: String,
    pub end_date: String,
    pub end_time: String,
    pub is_deadline: bool,
}

#[derive(Debug, Clone)]
pub struct CalendarDeadline {
    pub cmid: u64,
    pub title: String,
    pub course_id: u64,
    pub timesort: i64,
    pub due_date: String,
    pub due_text: String,
    pub description: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HandoutItem {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Default)]
pub struct ScrapedAssignmentDetails {
    pub status: String,
    pub weight: Option<String>,
    pub description: Option<String>,
    pub due_date_text: Option<String>,
    pub handouts: Vec<HandoutItem>,
}

/// Parses raw iCalendar (.ics) string using the `ical` crate.
pub fn parse_ics(ics_data: &str) -> Vec<ParsedCalendarEvent> {
    let reader = BufReader::new(ics_data.as_bytes());
    let parser = IcalParser::new(reader);
    let mut results = Vec::new();

    for calendar in parser.flatten() {
        for event in calendar.events {
            let mut uid = String::new();
            let mut summary = String::new();
            let mut description = String::new();
            let mut dtstart = String::new();
            let mut dtend = String::new();

            for prop in event.properties {
                match prop.name.as_str() {
                    "UID" => uid = prop.value.unwrap_or_default(),
                    "SUMMARY" => summary = prop.value.unwrap_or_default(),
                    "DESCRIPTION" => description = prop.value.unwrap_or_default(),
                    "DTSTART" => dtstart = prop.value.unwrap_or_default(),
                    "DTEND" => dtend = prop.value.unwrap_or_default(),
                    _ => {}
                }
            }

            if summary.is_empty() {
                continue;
            }

            if uid.is_empty() {
                uid = uuid::Uuid::new_v4().to_string();
            }

            let (start_date, start_time) = parse_ics_datetime(&dtstart);
            let (end_date, end_time) = parse_ics_datetime(&dtend);

            let lower_summary = summary.to_lowercase();
            let is_deadline = lower_summary.contains("due")
                || lower_summary.contains("deadline")
                || lower_summary.contains("assignment")
                || lower_summary.contains("submission")
                || lower_summary.contains("提出")
                || lower_summary.contains("課題")
                || lower_summary.contains("quiz")
                || lower_summary.contains("小テスト")
                || (start_date == end_date && start_time == end_time);

            results.push(ParsedCalendarEvent {
                uid,
                summary,
                description,
                start_date,
                start_time,
                end_date,
                end_time,
                is_deadline,
            });
        }
    }

    results
}

fn parse_ics_datetime(raw: &str) -> (String, String) {
    let clean = raw.trim();
    if let Some(t_idx) = clean.find('T') {
        let date_part = &clean[..t_idx];
        let time_part = &clean[t_idx + 1..];

        let date_str = if date_part.len() >= 8 {
            format!(
                "{}-{}-{}",
                &date_part[0..4],
                &date_part[4..6],
                &date_part[6..8]
            )
        } else {
            String::new()
        };

        let time_str = if time_part.len() >= 4 {
            format!("{}:{}", &time_part[0..2], &time_part[2..4])
        } else {
            String::new()
        };

        (date_str, time_str)
    } else if clean.len() >= 8 {
        (
            format!("{}-{}-{}", &clean[0..4], &clean[4..6], &clean[6..8]),
            "09:00".to_string(),
        )
    } else {
        (String::new(), String::new())
    }
}

/// Extracts the active Moodle `sesskey` token and returns the full dashboard HTML.
pub async fn get_dashboard_info(client: &reqwest::Client) -> Result<(String, String)> {
    let resp = client
        .get(LMS_MY_PAGE)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to fetch LMS dashboard: {}", e))?;
    let html = resp
        .text()
        .await
        .map_err(|e| anyhow!("Failed to read LMS dashboard HTML: {}", e))?;

    static SESSKEY_REGEX: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = SESSKEY_REGEX.get_or_init(|| {
        Regex::new(r#""sesskey"\s*:\s*"([A-Za-z0-9]{1,64})""#).unwrap()
    });

    if let Some(caps) = re.captures(&html) {
        if let Some(m) = caps.get(1) {
            return Ok((m.as_str().to_string(), html));
        }
    }

    Err(anyhow!(
        "Could not extract Moodle sesskey from dashboard. The session may have expired."
    ))
}

pub async fn get_dashboard_sesskey(client: &reqwest::Client) -> Result<String> {
    let (sesskey, _) = get_dashboard_info(client).await?;
    Ok(sesskey)
}

/// Calls Moodle AJAX `lib/ajax/service.php` with session cookies and sesskey.
pub async fn call_moodle_ajax(
    client: &reqwest::Client,
    sesskey: &str,
    method: &str,
    args: Value,
) -> Result<Value> {
    let mut url = url::Url::parse(&format!("{}/lib/ajax/service.php", LMS_BASE))?;
    url.query_pairs_mut()
        .append_pair("sesskey", sesskey)
        .append_pair("info", method);

    let payload = json!([
        {
            "index": 0,
            "methodname": method,
            "args": args
        }
    ]);

    let resp = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to call Moodle service {}: {}", method, e))?;

    let json: Value = resp
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse Moodle service {} response: {}", method, e))?;

    if let Some(arr) = json.as_array() {
        if let Some(first) = arr.first() {
            if first.get("error").and_then(|v| v.as_bool()) == Some(true) {
                let msg = first
                    .get("exception")
                    .and_then(|e| e.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("Unknown Moodle service error");
                return Err(anyhow!("Moodle error in {}: {}", method, msg));
            }
            if let Some(data) = first.get("data") {
                return Ok(data.clone());
            }
        }
    }

    Ok(json)
}

pub fn decode_entities(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find('&') {
        out.push_str(&rest[..start]);
        rest = &rest[start..];
        let decoded = rest.find(';').filter(|end| *end <= 10).and_then(|end| {
            let entity = &rest[1..end];
            let character = match entity {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" | "#39" => Some('\''),
                "nbsp" => Some(' '),
                _ => entity
                    .strip_prefix("#x")
                    .or_else(|| entity.strip_prefix("#X"))
                    .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                    .or_else(|| entity.strip_prefix('#').and_then(|dec| dec.parse().ok()))
                    .and_then(char::from_u32),
            }?;
            Some((character, end))
        });
        match decoded {
            Some((character, end)) => {
                out.push(character);
                rest = &rest[end + 1..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    decode_entities(
        &result
            .replace("&nbsp;", " ")
            .trim(),
    )
}

fn parse_course_code(shortname: &str) -> String {
    let clean = shortname.trim();
    if let Some(pos) = clean.find('[') {
        clean[..pos].trim().to_string()
    } else {
        clean.to_string()
    }
}

fn clean_course_title(fullname: &str) -> String {
    let trimmed = fullname.trim();
    if let Some((ja, en)) = trimmed.split_once(" / ") {
        if !en.trim().is_empty() {
            return format!("{} ({})", en.trim(), ja.trim());
        }
    }
    trimmed.to_string()
}

fn format_timesort_due(timesort: i64) -> (String, String) {
    if timesort <= 0 {
        return ("No due date".to_string(), "Ongoing".to_string());
    }

    let dt = DateTime::<Utc>::from_timestamp(timesort, 0).unwrap_or_else(|| Utc::now());
    let jst = dt.with_timezone(&chrono::FixedOffset::east_opt(9 * 3600).unwrap());
    let due_date_str = jst.format("%Y-%m-%d %H:%M JST").to_string();

    let now_ts = Utc::now().timestamp();
    let diff = timesort - now_ts;
    let due_text_str = if diff < 0 {
        "Overdue".to_string()
    } else if diff < 86400 {
        "Due today".to_string()
    } else if diff < 2 * 86400 {
        "Due tomorrow".to_string()
    } else {
        format!("Due in {} days", diff / 86400)
    };

    (due_date_str, due_text_str)
}

// ==========================================
// Science Tokyo LMS Timetable Parsing Engine
// ==========================================

#[derive(Debug, Clone)]
pub struct TimetableSlot {
    pub course_id: u64,
    pub quarter: String, // "1Q", "2Q", "3Q", "4Q"
    pub day: usize,      // 1 = Mon .. 7 = Sun
    pub period: u64,     // 1..12
}

#[derive(Debug, Clone, Default)]
pub struct CourseScheduleInfo {
    pub academic_year: String,
    pub quarters: Vec<String>,
    pub day_slots: HashMap<usize, Vec<u64>>, // day (1..7) -> periods (1..12)
    pub is_unscheduled: bool,
}

pub fn period_to_time_pair(period: u64) -> (&'static str, &'static str) {
    match period {
        1 => ("08:50", "09:40"),
        2 => ("09:40", "10:30"),
        3 => ("10:45", "11:35"),
        4 => ("11:35", "12:25"),
        5 => ("13:30", "14:20"),
        6 => ("14:20", "15:10"),
        7 => ("15:25", "16:15"),
        8 => ("16:15", "17:05"),
        9 => ("17:15", "18:05"),
        10 => ("18:05", "18:55"),
        11 => ("19:05", "19:55"),
        12 => ("19:55", "20:45"),
        _ => ("09:00", "10:30"),
    }
}

pub fn periods_to_time_range(periods: &[u64]) -> (&'static str, &'static str) {
    if periods.is_empty() {
        return ("09:00", "10:30");
    }
    let min_p = *periods.iter().min().unwrap();
    let max_p = *periods.iter().max().unwrap();

    let start = period_to_time_pair(min_p).0;
    let end = period_to_time_pair(max_p).1;

    (start, end)
}

pub fn day_name(day: usize) -> &'static str {
    match day {
        1 => "Mon",
        2 => "Tue",
        3 => "Wed",
        4 => "Thu",
        5 => "Fri",
        6 => "Sat",
        _ => "Sun",
    }
}

pub fn format_schedule(day_slots: &HashMap<usize, Vec<u64>>) -> String {
    if day_slots.is_empty() {
        return "On-Demand / Project".to_string();
    }

    let mut day_keys: Vec<usize> = day_slots.keys().cloned().collect();
    day_keys.sort();

    let day_ranges: Vec<(usize, String, String)> = day_keys
        .iter()
        .map(|d| {
            let periods = &day_slots[d];
            let (start, end) = periods_to_time_range(periods);
            (*d, start.to_string(), end.to_string())
        })
        .collect();

    let mut range_groups: HashMap<(String, String), Vec<usize>> = HashMap::new();
    for (d, s, e) in day_ranges {
        range_groups.entry((s, e)).or_default().push(d);
    }

    let mut parts = Vec::new();
    for ((s, e), days) in range_groups {
        let day_str = days
            .iter()
            .map(|d| day_name(*d))
            .collect::<Vec<_>>()
            .join(" & ");
        parts.push(format!("{} {} - {}", day_str, s, e));
    }

    parts.join(", ")
}

fn extract_course_id_from_url(url: &str) -> Option<String> {
    if let Some(pos) = url.find("id=") {
        let after = &url[pos + 3..];
        let end = after.find('&').unwrap_or(after.len());
        Some(after[..end].to_string())
    } else {
        None
    }
}

pub(crate) fn extract_cmid_from_url(url: &str) -> Option<u64> {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some((_, val)) = parsed.query_pairs().find(|(k, _)| k == "id") {
            if let Ok(id) = val.parse::<u64>() {
                if id > 0 {
                    return Some(id);
                }
            }
        }
    } else {
        static CMID_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        let re = CMID_RE.get_or_init(|| regex::Regex::new(r"[?&]id=(\d+)").unwrap());
        if let Some(caps) = re.captures(url) {
            if let Some(m) = caps.get(1) {
                return m.as_str().parse::<u64>().ok();
            }
        }
    }
    None
}

fn parse_timetable_filters(html: &str) -> (String, String, String, String) {
    let document = scraper::Html::parse_document(html);

    // Dynamic fallback based on Japanese academic calendar
    let now_utc = chrono::Utc::now();
    let jst = chrono::FixedOffset::east_opt(9 * 3600).unwrap();
    let now_japan = now_utc.with_timezone(&jst).date_naive();
    let calc_year = if now_japan.month() < 4 {
        now_japan.year() - 1
    } else {
        now_japan.year()
    };
    let calc_quota = match now_japan.month() {
        4 | 5 => "1",
        6 | 7 | 8 | 9 => "2",
        10 | 11 => "3",
        _ => "4",
    };

    let mut year_val = calc_year.to_string();
    let mut year_label = calc_year.to_string();
    let mut quota_val = calc_quota.to_string();
    let mut quota_label = calc_quota.to_string();

    // Select the timetable block [data-block="tttimetable"] first, matching adpt-isct
    let block_selector = scraper::Selector::parse(r#"[data-block="tttimetable"]"#).unwrap();
    if let Some(block) = document.select(&block_selector).next() {
        let select_selector = scraper::Selector::parse("select").unwrap();
        let option_selector = scraper::Selector::parse("option").unwrap();

        for select in block.select(&select_selector) {
            let name = select.value().attr("name").unwrap_or("");
            if name == "year" {
                let options: Vec<_> = select.select(&option_selector).collect();
                if let Some(opt) = options.iter().find(|o| o.value().attr("selected").is_some()).or_else(|| options.first()) {
                    let v = opt.value().attr("value").unwrap_or("").to_string();
                    let text: String = opt.text().collect::<String>().trim().to_string();
                    if !text.is_empty() {
                        year_label = text;
                    }
                    if !v.is_empty() {
                        year_val = v;
                    } else {
                        year_val = year_label.clone();
                    }
                }
            } else if name == "quota" {
                let options: Vec<_> = select.select(&option_selector).collect();
                if let Some(opt) = options.iter().find(|o| o.value().attr("selected").is_some()).or_else(|| options.first()) {
                    let v = opt.value().attr("value").unwrap_or("").to_string();
                    let text: String = opt.text().collect::<String>().trim().to_string();
                    let clean_label = if let Some(ch) = text.chars().find(|c| matches!(c, '1' | '2' | '3' | '4')) {
                        ch.to_string()
                    } else {
                        text
                    };
                    if !clean_label.is_empty() {
                        quota_label = clean_label;
                    }
                    if !v.is_empty() {
                        quota_val = v;
                    } else {
                        quota_val = quota_label.clone();
                    }
                }
            }
        }
    }

    (year_val, year_label, quota_val, quota_label)
}

fn parse_moodle_timetable_html(
    html: &str,
    default_quarter: &str,
) -> (Vec<TimetableSlot>, Vec<u64>) {
    let document = scraper::Html::parse_document(html);
    let mut slots = Vec::new();
    let mut unscheduled = Vec::new();

    let block_selector = match scraper::Selector::parse(r#"[data-block="tttimetable"]"#) {
        Ok(s) => s,
        Err(_) => return (slots, unscheduled),
    };

    let Some(block) = document.select(&block_selector).next() else {
        return (slots, unscheduled);
    };

    let table_selector = scraper::Selector::parse("table").unwrap();
    let tr_selector = scraper::Selector::parse("tr").unwrap();
    let td_th_selector = scraper::Selector::parse("td, th").unwrap();
    let a_selector = scraper::Selector::parse(r#"a[href*="course/view.php?id="]"#).unwrap();

    let tables: Vec<_> = block.select(&table_selector).collect();
    if let Some(grid) = tables.first() {
        let rows: Vec<_> = grid.select(&tr_selector).collect();
        for row in rows.iter().skip(1) {
            let cells: Vec<_> = row.select(&td_th_selector).collect();
            if cells.is_empty() {
                continue;
            }
            let period_str: String = cells[0].text().collect();
            let period: u64 = period_str.trim().parse().unwrap_or(0);
            if period == 0 {
                continue;
            }

            for (day_idx, cell) in cells.iter().skip(1).enumerate().take(7) {
                let day = day_idx + 1; // 1 = Mon .. 7 = Sun
                for a in cell.select(&a_selector) {
                    if let Some(href) = a.value().attr("href") {
                        if let Some(id_str) = extract_course_id_from_url(href) {
                            if let Ok(cid) = id_str.parse::<u64>() {
                                slots.push(TimetableSlot {
                                    course_id: cid,
                                    quarter: default_quarter.to_string(),
                                    day,
                                    period,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(other) = tables.get(1) {
        for a in other.select(&a_selector) {
            if let Some(href) = a.value().attr("href") {
                if let Some(id_str) = extract_course_id_from_url(href) {
                    if let Ok(cid) = id_str.parse::<u64>() {
                        unscheduled.push(cid);
                    }
                }
            }
        }
    }

    (slots, unscheduled)
}

pub async fn fetch_all_quarter_timetables(
    client: &reqwest::Client,
    dashboard_html: &str,
) -> (String, String, HashMap<u64, CourseScheduleInfo>) {
    let mut course_map: HashMap<u64, CourseScheduleInfo> = HashMap::new();

    let (year_val, year_label, current_quota_val, current_quota_label) =
        parse_timetable_filters(dashboard_html);
    let active_quarter_str = format!("{}Q", current_quota_label);

    log::info!(
        "Science Tokyo Moodle: active Year {} (val {}), Quarter {} (val {})",
        year_label,
        year_val,
        current_quota_label,
        current_quota_val
    );

    // 1. Parse current quarter from dashboard HTML
    let (cur_slots, cur_unscheduled) =
        parse_moodle_timetable_html(dashboard_html, &active_quarter_str);
    for slot in cur_slots {
        let entry = course_map
            .entry(slot.course_id)
            .or_insert_with(|| CourseScheduleInfo {
                academic_year: year_label.clone(),
                quarters: Vec::new(),
                day_slots: HashMap::new(),
                is_unscheduled: false,
            });
        if !entry.quarters.contains(&active_quarter_str) {
            entry.quarters.push(active_quarter_str.clone());
        }
        entry.day_slots.entry(slot.day).or_default().push(slot.period);
    }
    for uid in cur_unscheduled {
        let entry = course_map.entry(uid).or_insert_with(|| CourseScheduleInfo {
            academic_year: year_label.clone(),
            quarters: Vec::new(),
            day_slots: HashMap::new(),
            is_unscheduled: true,
        });
        if !entry.quarters.contains(&active_quarter_str) {
            entry.quarters.push(active_quarter_str.clone());
        }
    }

    // 2. Fetch other 3 quarters from /2025/my/index.php
    let other_quotas = ["1", "2", "3", "4"];
    let post_url = "https://lms.s.isct.ac.jp/2025/my/index.php";

    for q_label in other_quotas {
        if q_label == current_quota_label {
            continue;
        }
        let quarter_str = format!("{}Q", q_label);
        let params = [
            ("year", year_val.as_str()),
            ("quota", q_label),
            ("search", "1"),
        ];

        if let Ok(resp) = client.post(post_url).form(&params).send().await {
            if resp.status().is_success() {
                if let Ok(html) = resp.text().await {
                    let (slots, unscheduled) =
                        parse_moodle_timetable_html(&html, &quarter_str);
                    for slot in slots {
                        let entry = course_map
                            .entry(slot.course_id)
                            .or_insert_with(|| CourseScheduleInfo {
                                academic_year: year_label.clone(),
                                quarters: Vec::new(),
                                day_slots: HashMap::new(),
                                is_unscheduled: false,
                            });
                        if !entry.quarters.contains(&quarter_str) {
                            entry.quarters.push(quarter_str.clone());
                        }
                        entry.day_slots.entry(slot.day).or_default().push(slot.period);
                    }
                    for uid in unscheduled {
                        let entry = course_map.entry(uid).or_insert_with(|| CourseScheduleInfo {
                            academic_year: year_label.clone(),
                            quarters: Vec::new(),
                            day_slots: HashMap::new(),
                            is_unscheduled: true,
                        });
                        if !entry.quarters.contains(&quarter_str) {
                            entry.quarters.push(quarter_str.clone());
                        }
                    }
                }
            }
        }
    }

    (year_label, active_quarter_str, course_map)
}

fn infer_quarter_from_title_or_code(title: &str, code: &str, fallback: &str) -> &'static str {
    let lower_title = title.to_lowercase();
    let lower_code = code.to_lowercase();

    if lower_title.contains("1q")
        || lower_code.contains("1q")
        || lower_title.contains("第一")
        || lower_title.contains("第1")
    {
        return "1Q";
    }
    if lower_title.contains("2q")
        || lower_code.contains("2q")
        || lower_title.contains("第二")
        || lower_title.contains("第2")
    {
        return "2Q";
    }
    if lower_title.contains("3q")
        || lower_code.contains("3q")
        || lower_title.contains("第三")
        || lower_title.contains("第3")
    {
        return "3Q";
    }
    if lower_title.contains("4q")
        || lower_code.contains("4q")
        || lower_title.contains("第四")
        || lower_title.contains("第4")
    {
        return "4Q";
    }
    if lower_title.contains(" i ") || lower_title.ends_with(" i") || lower_title.contains(" 1 ") || lower_title.ends_with(" 1") {
        return "1Q";
    }
    if lower_title.contains(" ii ") || lower_title.ends_with(" ii") || lower_title.contains(" 2 ") || lower_title.ends_with(" 2") {
        return "2Q";
    }

    match fallback {
        "1Q" => "1Q",
        "2Q" => "2Q",
        "3Q" => "3Q",
        "4Q" => "4Q",
        _ => "3Q",
    }
}

/// Extracts academic year from shortname trailing format "[YYYY]" (e.g. "ENT.G301[2026]" -> "2026")
pub fn parse_academic_year(shortname: &str, default_year: &str) -> String {
    if let Some(open) = shortname.rfind('[') {
        if let Some(close) = shortname.rfind(']') {
            if close > open {
                let candidate = &shortname[open + 1..close];
                if candidate.len() == 4 && candidate.chars().all(|ch| ch.is_ascii_digit()) {
                    return candidate.to_string();
                }
            }
        }
    }
    default_year.to_string()
}

/// Parses the quarter from Moodle's coursecategory ("1" -> "1Q", "2" -> "2Q", etc.)
/// falling back to inference from course title and code.
pub fn parse_course_quarter(c: &Value, title: &str, code: &str, fallback_quarter: &str) -> String {
    if let Some(cat) = c.get("coursecategory") {
        let cat_str = if let Some(s) = cat.as_str() {
            s.to_string()
        } else if let Some(n) = cat.as_u64() {
            n.to_string()
        } else {
            String::new()
        };
        match cat_str.as_str() {
            "1" => return "1Q".to_string(),
            "2" => return "2Q".to_string(),
            "3" => return "3Q".to_string(),
            "4" => return "4Q".to_string(),
            _ => {}
        }
    }
    infer_quarter_from_title_or_code(title, code, fallback_quarter).to_string()
}

/// Scrapes assignment details, instructions, handout attachments, and submission status from /mod/{module}/view.php.
pub async fn scrape_module_page(
    client: &reqwest::Client,
    module: &str,
    cmid: u64,
) -> Result<ScrapedAssignmentDetails> {
    let url = format!("{}/mod/{}/view.php?id={}", LMS_BASE, module, cmid);
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Failed to fetch view.php for cmid {}: {}", cmid, e);
            return Ok(ScrapedAssignmentDetails::default());
        }
    };

    if !resp.status().is_success() {
        return Ok(ScrapedAssignmentDetails::default());
    }

    let is_html = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|ct| ct.contains("text/html"))
        .unwrap_or(false);

    if !is_html {
        return Ok(ScrapedAssignmentDetails::default());
    }

    let html = resp.text().await.unwrap_or_default();
    if html.is_empty() {
        return Ok(ScrapedAssignmentDetails::default());
    }

    // Scoped HTML parsing so scraper::Html is dropped before returning
    let details = {
        let doc = scraper::Html::parse_document(&html);
        let root = doc.root_element();

        let (status, weight) = match module {
            "assign" => {
                let table_sel = scraper::Selector::parse(".submissionstatustable").unwrap();
                if let Some(table) = root.select(&table_sel).next() {
                    let graded_sel = scraper::Selector::parse("td.submissiongraded").unwrap();
                    let submitted_sel = scraper::Selector::parse("td.submissionstatussubmitted").unwrap();
                    let st = if table.select(&graded_sel).next().is_some() {
                        "graded".to_string()
                    } else if table.select(&submitted_sel).next().is_some() {
                        "submitted".to_string()
                    } else {
                        "pending".to_string()
                    };

                    let feedback_sel = scraper::Selector::parse(".feedback .feedbacktable table tr td").unwrap();
                    let grade_opt = table
                        .select(&feedback_sel)
                        .next()
                        .or_else(|| root.select(&feedback_sel).next())
                        .and_then(|cell| {
                            let text = cell.text().collect::<String>().trim().to_string();
                            if !text.is_empty() && text != "-" {
                                Some(format!("Graded: {}", text))
                            } else {
                                None
                            }
                        });

                    (st, grade_opt)
                } else {
                    ("pending".to_string(), None)
                }
            }
            "quiz" => {
                let attempt_sel = scraper::Selector::parse(".quizattempt").unwrap();
                if root.select(&attempt_sel).next().is_some() {
                    let summary_tr_sel = scraper::Selector::parse("table.quizreviewsummary tr").unwrap();
                    let tr_count = root.select(&summary_tr_sel).count();
                    let finished = tr_count >= 3;

                    let feedback_h3_sel = scraper::Selector::parse("#feedback h3").unwrap();
                    static PAIR_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
                    let re = PAIR_RE.get_or_init(|| regex::Regex::new(r"(\d[\d.,]*)\s*/\s*(\d[\d.,]*)").unwrap());

                    let mut grade_str = None;
                    for h3 in root.select(&feedback_h3_sel) {
                        let text = h3.text().collect::<String>();
                        if let Some(caps) = re.captures(&text) {
                            if let (Some(m1), Some(m2)) = (caps.get(1), caps.get(2)) {
                                grade_str = Some(format!("Graded: {} / {}", m1.as_str(), m2.as_str()));
                                break;
                            }
                        }
                    }

                    if grade_str.is_some() {
                        ("graded".to_string(), grade_str)
                    } else if finished {
                        ("submitted".to_string(), None)
                    } else {
                        ("pending".to_string(), None)
                    }
                } else {
                    ("pending".to_string(), None)
                }
            }
            _ => ("pending".to_string(), None),
        };

        // Instructions and Dates from [data-region="activity-dates"] and #intro
        let intro_sel = scraper::Selector::parse("#intro").unwrap();
        let dates_sel = scraper::Selector::parse(r#"[data-region="activity-dates"], [data-region="activity-information"]"#).unwrap();

        let mut desc_parts = Vec::new();

        if let Some(dates_el) = root.select(&dates_sel).next() {
            let t = dates_el.text().collect::<Vec<_>>().join(" ");
            let clean = t.split_whitespace().collect::<Vec<_>>().join(" ");
            if !clean.is_empty() {
                desc_parts.push(clean);
            }
        }

        if let Some(intro_el) = root.select(&intro_sel).next() {
            let t = intro_el.text().collect::<Vec<_>>().join(" ");
            let clean = t.split_whitespace().collect::<Vec<_>>().join(" ");
            if !clean.is_empty() {
                desc_parts.push(clean);
            }
        }

        let description = if !desc_parts.is_empty() {
            Some(desc_parts.join("\n\n"))
        } else {
            None
        };

        // Due date text fallback from page
        let mut page_due_date = None;
        let tr_sel = scraper::Selector::parse(".submissionstatustable tr").unwrap();
        let th_sel = scraper::Selector::parse("th").unwrap();
        let td_sel = scraper::Selector::parse("td").unwrap();

        for tr in root.select(&tr_sel) {
            if let Some(th) = tr.select(&th_sel).next() {
                let th_text = th.text().collect::<String>().to_lowercase();
                if th_text.contains("due") || th_text.contains("期限") || th_text.contains("終了") {
                    if let Some(td) = tr.select(&td_sel).next() {
                        let val = td.text().collect::<String>().trim().to_string();
                        if !val.is_empty() && val != "-" {
                            page_due_date = Some(val);
                            break;
                        }
                    }
                }
            }
        }

        if page_due_date.is_none() {
            if let Some(dates_el) = root.select(&dates_sel).next() {
                let t = dates_el.text().collect::<String>();
                for line in t.lines() {
                    let l_lower = line.to_lowercase();
                    if l_lower.contains("due:") || l_lower.contains("期限:") || l_lower.contains("due date") {
                        let clean = line.replace("Due:", "").replace("期限:", "").trim().to_string();
                        if !clean.is_empty() {
                            page_due_date = Some(clean);
                            break;
                        }
                    }
                }
            }
        }

        // Handout files inside #intro or generalbox, ignoring student submission tables
        let plugin_link_sel = scraper::Selector::parse(r#"a[href*="/pluginfile.php/"]"#).unwrap();
        let mut handouts = Vec::new();

        for a in root.select(&plugin_link_sel) {
            let mut is_submission = false;
            let mut curr = a.parent();
            while let Some(parent) = curr {
                if let Some(elem) = scraper::ElementRef::wrap(parent) {
                    if elem.value().classes().any(|c| c == "submissionstatustable") {
                        is_submission = true;
                        break;
                    }
                }
                curr = parent.parent();
            }

            if !is_submission {
                if let Some(href) = a.value().attr("href") {
                    let raw_text = a.text().collect::<String>().trim().to_string();
                    let name = if !raw_text.is_empty() {
                        decode_entities(&raw_text)
                    } else {
                        href.rsplit('/').next().unwrap_or("handout").to_string()
                    };

                    if !handouts.iter().any(|h: &HandoutItem| h.url == href) {
                        handouts.push(HandoutItem {
                            name,
                            url: href.to_string(),
                        });
                    }
                }
            }
        }

        ScrapedAssignmentDetails {
            status,
            weight,
            description,
            due_date_text: page_due_date,
            handouts,
        }
    };

    Ok(details)
}

/// Fetches complete deadlines from action events, upcoming view, and monthly calendar views.
pub async fn fetch_all_calendar_deadlines(
    client: &reqwest::Client,
    sesskey: &str,
) -> HashMap<u64, CalendarDeadline> {
    let mut deadlines = HashMap::new();

    // 1. Action events by timesort
    if let Ok(action_data) = call_moodle_ajax(
        client,
        sesskey,
        "core_calendar_get_action_events_by_timesort",
        json!({
            "timesortfrom": 0,
            "limitnum": 100
        }),
    )
    .await
    {
        if let Some(events_list) = action_data.get("events").and_then(Value::as_array) {
            for ev in events_list {
                let cmid = ev
                    .get("url")
                    .and_then(Value::as_str)
                    .and_then(extract_cmid_from_url)
                    .or_else(|| ev.get("instance").and_then(Value::as_u64));

                if let Some(id) = cmid {
                    let timesort = ev
                        .get("timesort")
                        .or_else(|| ev.get("timestart"))
                        .and_then(Value::as_i64)
                        .unwrap_or(0);
                    let (due_date, due_text) = format_timesort_due(timesort);
                    let raw_name = ev
                        .get("name")
                        .or_else(|| ev.get("activityname"))
                        .and_then(Value::as_str)
                        .unwrap_or("Untitled Assignment");
                    let name = decode_entities(raw_name);
                    let course_id = ev
                        .get("course")
                        .and_then(|c| c.get("id"))
                        .and_then(Value::as_u64)
                        .unwrap_or(0);
                    let desc = strip_html_tags(ev.get("description").and_then(Value::as_str).unwrap_or(""));

                    deadlines.insert(
                        id,
                        CalendarDeadline {
                            cmid: id,
                            title: name,
                            course_id,
                            timesort,
                            due_date,
                            due_text,
                            description: desc,
                        },
                    );
                }
            }
        }
    }

    // 2. Upcoming calendar view
    if let Ok(upcoming_data) = call_moodle_ajax(
        client,
        sesskey,
        "core_calendar_get_calendar_upcoming_view",
        json!({
            "courseid": 1,
            "categoryid": 0
        }),
    )
    .await
    {
        if let Some(events_list) = upcoming_data.get("events").and_then(Value::as_array) {
            for ev in events_list {
                let module = ev.get("modulename").and_then(Value::as_str).unwrap_or("");
                let url_str = ev.get("url").and_then(Value::as_str).unwrap_or("");
                if module == "assign"
                    || module == "quiz"
                    || url_str.contains("/mod/assign/")
                    || url_str.contains("/mod/quiz/")
                {
                    if let Some(id) = extract_cmid_from_url(url_str)
                        .or_else(|| ev.get("instance").and_then(Value::as_u64))
                    {
                        let timesort = ev
                            .get("timesort")
                            .or_else(|| ev.get("timestart"))
                            .and_then(Value::as_i64)
                            .unwrap_or(0);
                        let (due_date, due_text) = format_timesort_due(timesort);
                        let raw_name = ev
                            .get("name")
                            .or_else(|| ev.get("activityname"))
                            .and_then(Value::as_str)
                            .unwrap_or("Untitled Assignment");
                        let name = decode_entities(raw_name);
                        let course_id = ev
                            .get("course")
                            .and_then(|c| c.get("id"))
                            .and_then(Value::as_u64)
                            .unwrap_or(0);
                        let desc = strip_html_tags(ev.get("description").and_then(Value::as_str).unwrap_or(""));

                        deadlines.entry(id).or_insert(CalendarDeadline {
                            cmid: id,
                            title: name,
                            course_id,
                            timesort,
                            due_date,
                            due_text,
                            description: desc,
                        });
                    }
                }
            }
        }
    }

    // 3. Monthly calendar view (current month, previous month, and next month)
    let now_utc = chrono::Utc::now();
    let jst = chrono::FixedOffset::east_opt(9 * 3600).unwrap();
    let now_jst = now_utc.with_timezone(&jst).date_naive();
    let cur_year = now_jst.year();
    let cur_month = now_jst.month();

    let prev_year = if cur_month == 1 { cur_year - 1 } else { cur_year };
    let prev_month = if cur_month == 1 { 12 } else { cur_month - 1 };

    let next_year = if cur_month == 12 { cur_year + 1 } else { cur_year };
    let next_month = if cur_month == 12 { 1 } else { cur_month + 1 };

    let months = [
        (cur_year, cur_month),
        (prev_year, prev_month),
        (next_year, next_month),
    ];

    for (y, m) in months {
        if let Ok(month_data) = call_moodle_ajax(
            client,
            sesskey,
            "core_calendar_get_calendar_monthly_view",
            json!({
                "year": y,
                "month": m,
                "courseid": 1,
                "categoryid": 0,
                "day": 1
            }),
        )
        .await
        {
            if let Some(weeks) = month_data.get("weeks").and_then(Value::as_array) {
                for week in weeks {
                    if let Some(days) = week.get("days").and_then(Value::as_array) {
                        for day in days {
                            if let Some(events) = day.get("events").and_then(Value::as_array) {
                                for ev in events {
                                    let module = ev.get("modulename").and_then(Value::as_str).unwrap_or("");
                                    let url_str = ev.get("url").and_then(Value::as_str).unwrap_or("");
                                    let eventtype = ev.get("eventtype").and_then(Value::as_str).unwrap_or("");

                                    if (module == "assign"
                                        || module == "quiz"
                                        || url_str.contains("/mod/assign/")
                                        || url_str.contains("/mod/quiz/"))
                                        && (eventtype == "due" || eventtype == "close" || eventtype.is_empty())
                                    {
                                        if let Some(id) = extract_cmid_from_url(url_str)
                                            .or_else(|| ev.get("instance").and_then(Value::as_u64))
                                        {
                                            let timesort = ev
                                                .get("timesort")
                                                .or_else(|| ev.get("timestart"))
                                                .and_then(Value::as_i64)
                                                .unwrap_or(0);
                                            let (due_date, due_text) = format_timesort_due(timesort);
                                            let raw_name = ev
                                                .get("name")
                                                .or_else(|| ev.get("activityname"))
                                                .and_then(Value::as_str)
                                                .unwrap_or("Untitled Assignment");
                                            let name = decode_entities(raw_name);
                                            let course_id = ev
                                                .get("course")
                                                .and_then(|c| c.get("id"))
                                                .and_then(Value::as_u64)
                                                .unwrap_or(0);
                                            let desc = strip_html_tags(ev.get("description").and_then(Value::as_str).unwrap_or(""));

                                            deadlines.entry(id).or_insert(CalendarDeadline {
                                                cmid: id,
                                                title: name,
                                                course_id,
                                                timesort,
                                                due_date,
                                                due_text,
                                                description: desc,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    deadlines
}

/// Fetches real enrolled courses and assignments from Science Tokyo LMS via Moodle Web Services API.
pub async fn fetch_real_lms_courses_and_assignments(
    client: &reqwest::Client,
    sesskey: &str,
    timetable_map: &HashMap<u64, CourseScheduleInfo>,
    active_year: &str,
    active_quarter: &str,
) -> Result<Vec<Course>> {
    log::info!("Querying Moodle AJAX for enrolled courses...");

    // 1. Fetch courses via core_course_get_enrolled_courses_by_timeline_classification
    let courses_data = call_moodle_ajax(
        client,
        sesskey,
        "core_course_get_enrolled_courses_by_timeline_classification",
        json!({
            "classification": "all",
            "limit": 0,
            "offset": 0,
            "sort": "fullname"
        }),
    )
    .await?;

    let course_items = courses_data
        .get("courses")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("Invalid course list shape returned by Moodle"))?;

    if course_items.is_empty() {
        log::warn!("Moodle returned 0 enrolled courses.");
        return Ok(Vec::new());
    }

    log::info!("Discovered {} courses on Science Tokyo LMS", course_items.len());

    // 2. Fetch complete deadlines from Action Events, Upcoming View & Monthly Calendar
    let calendar_deadlines = fetch_all_calendar_deadlines(client, sesskey).await;
    log::info!(
        "Discovered {} calendar assignment/quiz deadlines across Moodle calendar feeds",
        calendar_deadlines.len()
    );

    // 3. For each course, fetch course outline state via core_courseformat_get_state
    // parsing double-encoded JSON and collecting target assign/quiz modules for page scraping
    struct RawCourseModule {
        cmid: u64,
        module: String,
        name: String,
    }

    let mut course_modules_map: HashMap<u64, Vec<RawCourseModule>> = HashMap::new();
    let mut all_scrape_targets: Vec<(u64, String)> = Vec::new();

    for c in course_items {
        let course_id_num = c.get("id").and_then(Value::as_u64).unwrap_or(0);
        if course_id_num == 0 {
            continue;
        }

        let raw_state = match call_moodle_ajax(
            client,
            sesskey,
            "core_courseformat_get_state",
            json!({ "courseid": course_id_num }),
        )
        .await
        {
            Ok(v) => v,
            Err(e) => {
                log::warn!("Failed to fetch courseformat_get_state for course {}: {}", course_id_num, e);
                Value::Null
            }
        };

        // Handle double-encoded JSON: Moodle returns data as JSON-encoded string
        let full_state: Value = match &raw_state {
            Value::String(text) => serde_json::from_str::<Value>(text).unwrap_or(Value::Null),
            other => {
                if let Some(data_str) = other.get("data").and_then(Value::as_str) {
                    serde_json::from_str::<Value>(data_str).unwrap_or(Value::Null)
                } else {
                    other.clone()
                }
            }
        };

        if let Some(cms) = full_state.get("cm").and_then(Value::as_array) {
            for cm in cms {
                let module = cm.get("module").and_then(Value::as_str).unwrap_or("").to_string();
                if module == "assign" || module == "quiz" {
                    let cmid = cm
                        .get("id")
                        .and_then(Value::as_u64)
                        .or_else(|| cm.get("id").and_then(Value::as_str).and_then(|s| s.parse().ok()))
                        .unwrap_or(0);

                    if cmid > 0 {
                        let raw_name = cm.get("name").and_then(Value::as_str).unwrap_or("Assignment");
                        let name = decode_entities(raw_name);

                        course_modules_map.entry(course_id_num).or_default().push(RawCourseModule {
                            cmid,
                            module: module.clone(),
                            name,
                        });

                        if !all_scrape_targets.iter().any(|(id, _)| *id == cmid) {
                            all_scrape_targets.push((cmid, module));
                        }
                    }
                }
            }
        }
    }

    // 4. Concurrently scrape assignment details (instructions, handouts, submission status, grade)
    // for up to 30 modules using tokio::task::JoinSet with bounded concurrency
    let sem = Arc::new(Semaphore::new(8));
    let mut set = tokio::task::JoinSet::new();

    for (cmid, module) in all_scrape_targets.into_iter().take(30) {
        let client_clone = client.clone();
        let sem_clone = sem.clone();
        set.spawn(async move {
            let _permit = sem_clone.acquire().await;
            let details = scrape_module_page(&client_clone, &module, cmid)
                .await
                .unwrap_or_default();
            (cmid, details)
        });
    }

    let mut scraped_map: HashMap<u64, ScrapedAssignmentDetails> = HashMap::new();
    while let Some(res) = set.join_next().await {
        if let Ok((cmid, details)) = res {
            scraped_map.insert(cmid, details);
        }
    }
    log::info!(
        "Scraped real details, instructions & status for {} LMS modules",
        scraped_map.len()
    );

    // 5. Assemble final courses
    let mut final_courses = Vec::new();

    for (idx, c) in course_items.iter().enumerate() {
        let course_id_num = c.get("id").and_then(Value::as_u64).unwrap_or(0);
        let course_id_str = course_id_num.to_string();
        let fullname = c
            .get("fullname")
            .and_then(Value::as_str)
            .unwrap_or("Unknown Course")
            .trim();
        let shortname = c
            .get("shortname")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();

        let code = parse_course_code(shortname);
        let title = clean_course_title(&decode_entities(fullname));
        let course_year = parse_academic_year(shortname, active_year);

        let (term, schedule) = if let Some(info) = timetable_map.get(&course_id_num) {
            let q_str = if info.quarters.is_empty() {
                parse_course_quarter(c, &title, &code, active_quarter)
            } else {
                info.quarters.join(", ")
            };
            let t = format!("{}-{}", course_year, q_str);
            let s = format_schedule(&info.day_slots);
            (t, s)
        } else {
            let q = parse_course_quarter(c, &title, &code, active_quarter);
            let t = format!("{}-{}", course_year, q);
            (t, "On-Demand / Project".to_string())
        };

        let color = PALETTE[idx % PALETTE.len()].to_string();

        let mut assignments: Vec<Assignment> = Vec::new();
        let raw_mods = course_modules_map.remove(&course_id_num).unwrap_or_default();

        for m in raw_mods {
            let cmid_str = m.cmid.to_string();
            let dl_opt = calendar_deadlines.get(&m.cmid);
            let sc_opt = scraped_map.get(&m.cmid);

            let a_title = if !m.name.is_empty() && m.name != "Assignment" {
                m.name.clone()
            } else if let Some(dl) = dl_opt {
                dl.title.clone()
            } else {
                m.name.clone()
            };

            let status = if let Some(sc) = sc_opt {
                sc.status.clone()
            } else {
                "pending".to_string()
            };

            let weight = if let Some(sc) = sc_opt {
                if let Some(w) = &sc.weight {
                    w.clone()
                } else if m.module == "quiz" {
                    "Moodle Quiz".to_string()
                } else {
                    "Moodle Task".to_string()
                }
            } else if m.module == "quiz" {
                "Moodle Quiz".to_string()
            } else {
                "Moodle Task".to_string()
            };

            let description = if let Some(sc) = sc_opt {
                if let Some(desc) = &sc.description {
                    desc.clone()
                } else if let Some(dl) = dl_opt {
                    if !dl.description.is_empty() {
                        dl.description.clone()
                    } else {
                        format!("Activity in {}", title)
                    }
                } else {
                    format!("Activity in {}", title)
                }
            } else if let Some(dl) = dl_opt {
                if !dl.description.is_empty() {
                    dl.description.clone()
                } else {
                    format!("Activity in {}", title)
                }
            } else {
                format!("Activity in {}", title)
            };

            let (due_date, due_text) = if let Some(dl) = dl_opt {
                (dl.due_date.clone(), dl.due_text.clone())
            } else if let Some(sc) = sc_opt {
                if let Some(d_text) = &sc.due_date_text {
                    (d_text.clone(), "Course Due Date".to_string())
                } else {
                    ("Active in Course Outline".to_string(), "Course Task".to_string())
                }
            } else {
                ("Active in Course Outline".to_string(), "Course Task".to_string())
            };

            let handout_name = if let Some(sc) = sc_opt {
                if !sc.handouts.is_empty() {
                    serde_json::to_string(&sc.handouts).unwrap_or_default()
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            assignments.push(Assignment {
                id: cmid_str,
                course_id: course_id_str.clone(),
                title: a_title,
                due_date,
                due_text,
                status,
                weight,
                description,
                handout_name,
                updated_at: Utc::now().to_rfc3339(),
            });
        }

        // Also add any calendar deadlines for this course not discovered in outline
        for (cmid, dl) in &calendar_deadlines {
            if dl.course_id == course_id_num {
                let cmid_str = cmid.to_string();
                if !assignments.iter().any(|a| a.id == cmid_str) {
                    let sc_opt = scraped_map.get(cmid);
                    let status = if let Some(sc) = sc_opt {
                        sc.status.clone()
                    } else {
                        "pending".to_string()
                    };
                    let weight = if let Some(sc) = sc_opt {
                        sc.weight.clone().unwrap_or_else(|| "LMS Activity".to_string())
                    } else {
                        "LMS Activity".to_string()
                    };
                    let description = if let Some(sc) = sc_opt {
                        sc.description.clone().unwrap_or_else(|| {
                            if !dl.description.is_empty() {
                                dl.description.clone()
                            } else {
                                format!("Activity in {}", title)
                            }
                        })
                    } else if !dl.description.is_empty() {
                        dl.description.clone()
                    } else {
                        format!("Activity in {}", title)
                    };
                    let handout_name = if let Some(sc) = sc_opt {
                        if !sc.handouts.is_empty() {
                            serde_json::to_string(&sc.handouts).unwrap_or_default()
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };

                    assignments.push(Assignment {
                        id: cmid_str,
                        course_id: course_id_str.clone(),
                        title: dl.title.clone(),
                        due_date: dl.due_date.clone(),
                        due_text: dl.due_text.clone(),
                        status,
                        weight,
                        description,
                        handout_name,
                        updated_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        final_courses.push(Course {
            id: course_id_str,
            code,
            title,
            instructor: "Science Tokyo Faculty".to_string(),
            schedule,
            room: "Science Tokyo LMS".to_string(),
            color,
            term,
            updated_at: Utc::now().to_rfc3339(),
            assignments,
        });
    }

    Ok(final_courses)
}

/// Synchronizes Science Tokyo LMS courses, assignments, and calendar feeds directly into SQLite.
pub async fn sync_courses_and_tasks(config_dir: &Path, pool: &SqlitePool) -> Result<String> {
    log::info!("Starting live LMS synchronization...");

    let client = get_authenticated_client(config_dir).await?;
    let (sesskey, dashboard_html) = get_dashboard_info(&client).await?;
    log::info!("Obtained active Moodle sesskey and dashboard for timetable parsing");

    // 1. Fetch exact quarter timetables from Moodle
    let (academic_year, active_quarter, timetable_map) =
        fetch_all_quarter_timetables(&client, &dashboard_html).await;
    log::info!(
        "Timetable parsed: active quarter is {} (academic year {}), {} scheduled courses mapped",
        active_quarter,
        academic_year,
        timetable_map.len()
    );

    // 2. Fetch real courses with accurate quarter and schedule
    let real_courses = fetch_real_lms_courses_and_assignments(
        &client,
        &sesskey,
        &timetable_map,
        &academic_year,
        &active_quarter,
    )
    .await?;

    let courses_to_save = if !real_courses.is_empty() {
        log::info!(
            "Found {} real enrolled courses from LMS. Cleaning old placeholder records...",
            real_courses.len()
        );
        let _ = sqlx::query("DELETE FROM courses WHERE id IN ('cs301', 'ai420', 'ph210', 'ma315', 'math210')")
            .execute(pool)
            .await;
        let _ = sqlx::query("DELETE FROM assignments WHERE course_id IN ('cs301', 'ai420', 'ph210', 'ma315', 'math210')")
            .execute(pool)
            .await;
        let _ = sqlx::query("DELETE FROM tasks WHERE source = 'science_tokyo' AND (id LIKE '%cs301%' OR id LIKE '%math210%')")
            .execute(pool)
            .await;
        real_courses
    } else {
        log::warn!("No courses returned by Moodle API, retaining existing data.");
        Vec::new()
    };

    if !courses_to_save.is_empty() {
        upsert_courses(pool, &courses_to_save).await?;
    }

    // 3. Populate SQLite schedule_blocks with real lectures for all 4 quarters (1Q-4Q)
    // Wipe old mock lectures and previous auto-synced lectures
    let _ = sqlx::query(
        "DELETE FROM schedule_blocks WHERE source = 'science_tokyo' AND (id LIKE 'isct-lec-%' OR id LIKE 'isct-block-%')"
    )
    .execute(pool)
    .await;

    let now_utc = chrono::Utc::now();
    let jst = chrono::FixedOffset::east_opt(9 * 3600).unwrap();
    let now_japan = now_utc.with_timezone(&jst).date_naive();

    // In Japan academic calendar, April starts the academic year.
    // January to March (month < 4) belongs to the 4th Quarter of the previous calendar year.
    let calculated_academic_year = if now_japan.month() < 4 {
        now_japan.year() - 1
    } else {
        now_japan.year()
    };
    let acad_year = academic_year.parse::<i32>().unwrap_or(calculated_academic_year);

    let all_quarters = [
        ("1Q", NaiveDate::from_ymd_opt(acad_year, 4, 1).unwrap(), NaiveDate::from_ymd_opt(acad_year, 5, 31).unwrap()),
        ("2Q", NaiveDate::from_ymd_opt(acad_year, 6, 1).unwrap(), NaiveDate::from_ymd_opt(acad_year, 7, 31).unwrap()),
        ("3Q", NaiveDate::from_ymd_opt(acad_year, 10, 1).unwrap(), NaiveDate::from_ymd_opt(acad_year, 11, 30).unwrap()),
        (
            "4Q",
            NaiveDate::from_ymd_opt(acad_year, 12, 1).unwrap(),
            NaiveDate::from_ymd_opt(acad_year + 1, 2, 29).unwrap_or_else(|| NaiveDate::from_ymd_opt(acad_year + 1, 2, 28).unwrap()),
        ),
    ];

    let mut lecture_blocks_count = 0;
    for (q_label, q_start, q_end) in all_quarters {
        let mut d = q_start;
        while d <= q_end {
            let weekday_num = d.weekday().number_from_monday() as usize; // 1 = Mon .. 7 = Sun

            for course in &courses_to_save {
                if let Ok(cid) = course.id.parse::<u64>() {
                    if let Some(info) = timetable_map.get(&cid) {
                        if info.quarters.iter().any(|q| q == q_label) {
                            if let Some(periods) = info.day_slots.get(&weekday_num) {
                                let (start, end) = periods_to_time_range(periods);
                                let min_period = periods.iter().min().unwrap_or(&1);
                                let block_id = format!("isct-lec-{}-{}-{}", cid, d, min_period);
                                let title = format!("{}: {}", course.code, course.title);

                                let res = sqlx::query(
                                    r#"
                                    INSERT INTO schedule_blocks (id, title, start_time, end_time, category, date, source, external_id)
                                    VALUES (?, ?, ?, ?, 'Lecture', ?, 'science_tokyo', ?)
                                    ON CONFLICT(id) DO UPDATE SET
                                        title = excluded.title,
                                        start_time = excluded.start_time,
                                        end_time = excluded.end_time
                                    "#
                                )
                                .bind(&block_id)
                                .bind(&title)
                                .bind(start)
                                .bind(end)
                                .bind(d.format("%Y-%m-%d").to_string())
                                .bind(&course.id)
                                .execute(pool)
                                .await;

                                if res.is_ok() {
                                    lecture_blocks_count += 1;
                                }
                            }
                        }
                    }
                }
            }
            d += chrono::Duration::days(1);
        }
    }

    log::info!("Generated {} real lecture timetable blocks across all 4 quarters (1Q-4Q) for academic year {}", lecture_blocks_count, acad_year);

    // Persist active academic year, active quarter, and sync timestamp into sync_metadata
    crate::db::set_sync_meta(pool, "active_academic_year", &academic_year).await?;
    crate::db::set_sync_meta(pool, "active_quarter", &active_quarter).await?;
    crate::db::set_sync_meta(pool, "last_synced_at", &chrono::Utc::now().to_rfc3339()).await?;

    log::info!("Generated {} real lecture timetable blocks in calendar for {}", lecture_blocks_count, active_quarter);

    // 4. Fetch .ics calendar feed for deadlines if available
    let calendar_resp = client.get(CALENDAR_EXPORT_URL).send().await;
    let events = match calendar_resp {
        Ok(resp) if resp.status().is_success() => {
            let ics_text = resp.text().await.unwrap_or_default();
            parse_ics(&ics_text)
        }
        _ => Vec::new(),
    };

    let mut tasks_synced = 0;
    for ev in &events {
        if ev.is_deadline {
            let task_id = format!("isct-task-{}", ev.uid);
            let created_at = chrono::Utc::now().to_rfc3339();
            let due_date = if !ev.end_date.is_empty() {
                Some(ev.end_date.clone())
            } else {
                Some(ev.start_date.clone())
            };

            let _ = sqlx::query(
                r#"
                INSERT INTO tasks (id, title, project, status, priority, due_date, completed, created_at, source, external_id)
                VALUES (?, ?, 'Science Tokyo', 'todo', 'high', ?, 0, ?, 'science_tokyo', ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    due_date = excluded.due_date
                "#,
            )
            .bind(&task_id)
            .bind(&ev.summary)
            .bind(&due_date)
            .bind(&created_at)
            .bind(&ev.uid)
            .execute(pool)
            .await;

            tasks_synced += 1;
        }
    }

    let total_assignments: usize = courses_to_save.iter().map(|c| c.assignments.len()).sum();
    let summary = format!(
        "Synced {} university courses across 1Q-4Q ({} active in {}), {} assignments, and {} lecture timetable blocks",
        courses_to_save.len(),
        timetable_map.values().filter(|i| i.quarters.iter().any(|q| q == &active_quarter)).count(),
        active_quarter,
        total_assignments,
        lecture_blocks_count + tasks_synced
    );
    log::info!("{}", summary);
    Ok(summary)
}

pub async fn upsert_courses(pool: &SqlitePool, courses: &[Course]) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();

    for course in courses {
        sqlx::query(
            r#"
            INSERT INTO courses (id, code, title, instructor, schedule, room, color, term, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                title = excluded.title,
                instructor = excluded.instructor,
                schedule = excluded.schedule,
                room = excluded.room,
                color = excluded.color,
                term = excluded.term,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&course.id)
        .bind(&course.code)
        .bind(&course.title)
        .bind(&course.instructor)
        .bind(&course.schedule)
        .bind(&course.room)
        .bind(&course.color)
        .bind(&course.term)
        .bind(&now)
        .execute(pool)
        .await?;

        // Clean up legacy assign-* rows for this course
        let _ = sqlx::query("DELETE FROM assignments WHERE course_id = ? AND id LIKE 'assign-%'")
            .bind(&course.id)
            .execute(pool)
            .await;
        let _ = sqlx::query("DELETE FROM tasks WHERE source = 'science_tokyo' AND id LIKE 'assign-task-assign-%'")
            .execute(pool)
            .await;

        // Clean up any stale assignments for this course that are no longer present
        if !course.assignments.is_empty() {
            let placeholders = vec!["?"; course.assignments.len()].join(",");
            let delete_sql = format!(
                "DELETE FROM assignments WHERE course_id = ? AND id NOT IN ({})",
                placeholders
            );
            let mut query = sqlx::query(&delete_sql).bind(&course.id);
            for a in &course.assignments {
                query = query.bind(&a.id);
            }
            let _ = query.execute(pool).await;
        }

        for a in &course.assignments {
            sqlx::query(
                r#"
                INSERT INTO assignments (id, course_id, title, due_date, due_text, status, weight, description, handout_name, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    due_date = excluded.due_date,
                    due_text = excluded.due_text,
                    status = excluded.status,
                    weight = excluded.weight,
                    description = excluded.description,
                    handout_name = excluded.handout_name,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(&a.id)
            .bind(&course.id)
            .bind(&a.title)
            .bind(&a.due_date)
            .bind(&a.due_text)
            .bind(&a.status)
            .bind(&a.weight)
            .bind(&a.description)
            .bind(&a.handout_name)
            .bind(&now)
            .execute(pool)
            .await?;

            // Also mirror assignment to Tasks table
            let task_id = format!("assign-task-{}", a.id);
            let date_only = a.due_date.split(' ').next().unwrap_or(&a.due_date);
            let _ = sqlx::query(
                r#"
                INSERT INTO tasks (id, title, project, status, priority, due_date, completed, created_at, source, external_id)
                VALUES (?, ?, ?, 'todo', 'high', ?, 0, ?, 'science_tokyo', ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    due_date = excluded.due_date
                "#,
            )
            .bind(&task_id)
            .bind(&format!("{}: {}", course.code, a.title))
            .bind(&course.title)
            .bind(date_only)
            .bind(&now)
            .bind(&a.id)
            .execute(pool)
            .await;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_live_sync_execution() {
        let config_dir = crate::config::get_app_config_dir().unwrap();
        if !config_dir.join("session.cookie").exists() {
            println!("Skipping: session.cookie does not exist");
            return;
        }

        let pool = crate::db::init_db(&config_dir).await.expect("Failed to init DB");
        match sync_courses_and_tasks(&config_dir, &pool).await {
            Ok(msg) => println!("SYNC SUCCESS: {}", msg),
            Err(e) => println!("SYNC FAILED: {:?}", e),
        }
    }
}

