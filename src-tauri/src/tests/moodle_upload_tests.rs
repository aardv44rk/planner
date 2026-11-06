use super::*;

#[test]
fn test_extract_moodle_filemanager_config_selects_upload_repo_over_recent() {
    let html = r#"
<!DOCTYPE html>
<html>
<head><title>Edit submission</title></head>
<body>
<form method="post" action="https://lms.s.isct.ac.jp/2025/mod/assign/view.php" id="mform1">
  <input type="hidden" name="id" value="44122">
  <input type="hidden" name="action" value="savesubmission">
  <input type="hidden" name="sesskey" value="test_sesskey_123">
  <input type="hidden" name="files_filemanager" value="987654321">
  <input type="hidden" name="contextid" value="54321">
</form>

<script type="text/javascript">
//<![CDATA[
M.form_filemanager.init(Y, {
    "client_id": "filemanager_6654",
    "itemid": 987654321,
    "maxbytes": 20971520,
    "areamaxbytes": -1,
    "contextid": 54321,
    "repositories": {
        "3": {
            "id": 3,
            "name": "Recent files",
            "type": "recent",
            "icon": "https://lms.s.isct.ac.jp/2025/theme/image.php/boost/repository_recent/123/icon"
        },
        "5": {
            "id": 5,
            "name": "Upload a file",
            "type": "upload",
            "icon": "https://lms.s.isct.ac.jp/2025/theme/image.php/boost/repository_upload/123/icon"
        },
        "6": {
            "id": 6,
            "name": "Private files",
            "type": "user",
            "icon": "https://lms.s.isct.ac.jp/2025/theme/image.php/boost/repository_user/123/icon"
        }
    }
});
//]]>
</script>
</body>
</html>
"#;

    let config = extract_moodle_filemanager_config(html)
        .expect("Failed to extract valid Moodle filemanager config");

    // The key bugfix: Must select repo id 5 ("upload"), NEVER repo id 3 ("recent")
    assert_eq!(config.upload_repo_id, "5");
    assert_ne!(config.upload_repo_id, "3");
    assert_eq!(config.sesskey, "test_sesskey_123");
    assert_eq!(config.draft_itemid, "987654321");
    assert_eq!(config.ctx_id, Some("54321".to_string()));
    assert_eq!(config.client_id, Some("filemanager_6654".to_string()));
}

#[test]
fn test_extract_upload_repo_id_from_array() {
    let html = r#"
<form>
  <input type="hidden" name="sesskey" value="sess_array_test">
  <input type="hidden" name="files_filemanager" value="11223344">
</form>
<script>
var fm_opts = {
    "client_id": "client_arr",
    "itemid": 11223344,
    "ctx_id": 7766,
    "repositories": [
        {"id": 4, "type": "recent", "name": "Recent files"},
        {"id": 8, "type": "upload", "name": "Upload a file"}
    ]
};
</script>
"#;

    let config = extract_moodle_filemanager_config(html)
        .expect("Failed to extract config with array repositories");

    assert_eq!(config.upload_repo_id, "8");
    assert_ne!(config.upload_repo_id, "4");
    assert_eq!(config.sesskey, "sess_array_test");
    assert_eq!(config.draft_itemid, "11223344");
    assert_eq!(config.ctx_id, Some("7766".to_string()));
    assert_eq!(config.client_id, Some("client_arr".to_string()));
}

#[test]
fn test_error_when_no_upload_repo() {
    let html = r#"
<form>
  <input type="hidden" name="sesskey" value="sess_fail_test">
  <input type="hidden" name="files_filemanager" value="12345">
</form>
<script>
var opts = {
    "repositories": {
        "3": {"id": 3, "type": "recent", "name": "Recent files"},
        "6": {"id": 6, "type": "user", "name": "Private files"}
    }
};
</script>
"#;

    let result = extract_moodle_filemanager_config(html);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("upload repository ID"));
}

#[test]
fn test_guess_mime_types() {
    assert_eq!(guess_mime("report.pdf"), "application/pdf");
    assert_eq!(guess_mime("archive.zip"), "application/zip");
    assert_eq!(guess_mime("solution.py"), "text/x-python");
    assert_eq!(guess_mime("data.csv"), "text/csv");
    assert_eq!(guess_mime("unknown.xyz123"), "application/octet-stream");
}
