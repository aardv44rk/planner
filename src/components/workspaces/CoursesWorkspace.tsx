import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  FileCheck,
  GraduationCap,
  Search,
  RefreshCw,
  Download,
  ExternalLink,
  Award,
} from 'lucide-react';
import { ResizableWorkspace } from '../ResizableWorkspace';
import { Tag, Button, Input } from '../ui/controls';
import { api } from '../../utils/ipc';
import { Course, Assignment, PickedFileResult } from '../../types';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { courseMatchesQuarter, sortCoursesForDisplay, getAvailableAcademicYears } from '../../utils/academic';

interface HandoutItemData {
  name: string;
  url?: string;
}

function parseHandouts(raw?: string): HandoutItemData[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
          .map((item) => ({
            name: item.name.trim(),
            url: typeof item.url === 'string' && item.url.startsWith('http') ? item.url : undefined,
          }));
      }
    } catch {
      // fallback
    }
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name }));
}

export const CoursesWorkspace: React.FC = () => {
  const {
    refreshAll,
    selectedQuarter,
    setSelectedQuarter,
    selectedAcademicYear,
    setSelectedAcademicYear,
    currentAcademicYear,
    currentQuarter,
  } = useCommandCenterStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [activeTab, setActiveTab] = useState<'instructions' | 'upload'>('instructions');
  const [searchQuery, setSearchQuery] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFileResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadCoursesFromDb();
  }, []);

  const loadCoursesFromDb = async () => {
    try {
      const list = await api.getCourses();
      if (list && list.length > 0) {
        setCourses(list);
        const matching = list.filter((c) =>
          courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear)
        );
        const sorted = sortCoursesForDisplay(matching);
        const first = sorted[0] || list[0];
        setSelectedCourse(first);
        if (first.assignments && first.assignments.length > 0) {
          setSelectedAssignment(first.assignments[0]);
        } else {
          setSelectedAssignment(null);
        }
      } else {
        setCourses([]);
        setSelectedCourse(null);
        setSelectedAssignment(null);
      }
    } catch (e) {
      console.error('Failed to load courses from SQLite database:', e);
    }
  };

  const availableAcademicYears = getAvailableAcademicYears(courses);
  const matchingCourses = courses.filter((c) =>
    courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear)
  );
  const filteredCourses = sortCoursesForDisplay(
    matchingCourses.filter(
      (c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  );

  const { allAssignmentsCount, pendingAssignmentsCount, completedAssignmentsCount } = React.useMemo(() => {
    let all = 0;
    let pending = 0;
    let completed = 0;
    for (const c of filteredCourses) {
      if (c.assignments) {
        for (const a of c.assignments) {
          all += 1;
          if (a.status === 'pending') {
            pending += 1;
          } else if (a.status === 'submitted' || a.status === 'graded') {
            completed += 1;
          }
        }
      }
    }
    return { allAssignmentsCount: all, pendingAssignmentsCount: pending, completedAssignmentsCount: completed };
  }, [filteredCourses]);

  const coursesToRender = React.useMemo(() => {
    return filteredCourses.filter((course) => {
      if (assignmentFilter === 'all') return true;
      const assignments = course.assignments || [];
      if (assignmentFilter === 'pending') {
        return assignments.some((a) => a.status === 'pending');
      }
      if (assignmentFilter === 'completed') {
        return assignments.some((a) => a.status === 'submitted' || a.status === 'graded');
      }
      return true;
    });
  }, [filteredCourses, assignmentFilter]);

  useEffect(() => {
    if (coursesToRender.length > 0) {
      if (!selectedCourse || !coursesToRender.some((c) => c.id === selectedCourse.id)) {
        const first = coursesToRender[0];
        setSelectedCourse(first);
        const matchingAssigns = (first.assignments || []).filter((a) => {
          if (assignmentFilter === 'pending') return a.status === 'pending';
          if (assignmentFilter === 'completed') return a.status === 'submitted' || a.status === 'graded';
          return true;
        });
        setSelectedAssignment(matchingAssigns[0] || first.assignments?.[0] || null);
      }
    }
  }, [coursesToRender, selectedCourse, assignmentFilter]);

  const handleSyncLms = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const msg = await api.syncLms();
      setSyncStatus(msg);
      await loadCoursesFromDb();
      await refreshAll();
    } catch (err: any) {
      setSyncStatus(typeof err === 'string' ? err : err?.message || 'Sync failed. Please check credentials in Settings.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const file = await api.pickAssignmentFile();
      if (file && file.path) {
        setPickedFile(file);
        setSubmissionSuccess(false);
      }
    } catch (err: any) {
      if (!err?.toString().includes('cancelled') && !err?.toString().includes('No file selected')) {
        alert(`File picker error: ${err}`);
      }
    }
  };

  const handleRealSubmit = async () => {
    if (!selectedAssignment || !pickedFile) return;
    setIsSubmitting(true);
    try {
      const result = await api.uploadAssignment(pickedFile.path, selectedAssignment.id);
      setSubmissionSuccess(true);
      setSubmissionMessage(result.message);
      await loadCoursesFromDb();
      await refreshAll();
    } catch (err: any) {
      alert(typeof err === 'string' ? err : err?.message || 'Failed to submit assignment to LMS');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden p-2 bg-canvas">
      <ResizableWorkspace
        id="courses"
        firstSize="32%"
        secondSize="68%"
        firstMin="290px"
        secondMin="440px"
      >
        {/* Left Pane: Scrollable List of Classes and Upcoming Assignments */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <BookOpen className="w-4 h-4 stroke-[1.75] text-accent flex-shrink-0" />
              <span className="text-[12px] font-semibold text-tx-primary truncate tracking-tight">
                Courses
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSyncLms}
                disabled={isSyncing}
                className="p-1 text-muted hover:text-accent rounded hover:bg-surface transition-colors cursor-pointer"
                title="Synchronize real courses & calendar from Science Tokyo LMS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-accent' : ''}`} />
              </button>
              <Tag tone="accent" variant="soft">
                {selectedQuarter === 'All' ? 'All Quarters' : `Quarter ${selectedQuarter}`}
              </Tag>
            </div>
          </header>

          {/* Sync Status Banner */}
          {syncStatus && (
            <div className="px-3 py-1.5 bg-accent-soft border-b border-accent/20 text-[11px] text-accent flex items-center justify-between">
              <span className="truncate pr-2">{syncStatus}</span>
              <button
                type="button"
                onClick={() => setSyncStatus(null)}
                className="text-[10px] opacity-75 hover:opacity-100 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Academic Year & Quarter Filter Selector */}
          <div className="px-2 py-1.5 border-b border-subtle bg-surface-2 flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar flex-shrink-0">
            {/* Year selector pills */}
            {availableAcademicYears.length > 1 && (
              <div className="flex items-center gap-1 bg-surface-3 p-0.5 rounded-[var(--radius-control)] flex-shrink-0">
                {availableAcademicYears.map((yr) => {
                  const isSel = selectedAcademicYear === yr;
                  const isCur = Number(yr) === currentAcademicYear;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedAcademicYear(yr)}
                      className={`text-[10px] px-2 py-0.5 rounded-[var(--radius-chip)] font-mono transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-surface text-tx-primary font-semibold shadow-xs'
                          : 'text-muted hover:text-tx-primary'
                      }`}
                    >
                      {yr} {isCur ? 'AY' : 'Archive'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quarter Filter Chips */}
            <div className="flex items-center gap-1">
              {['3Q', '4Q', '1Q', '2Q', 'All'].map((q) => {
                const isSelected = selectedQuarter === q;
                const isCurrent = q === currentQuarter && Number(selectedAcademicYear) === currentAcademicYear;
                const count = q === 'All'
                  ? courses.filter((c) => courseMatchesQuarter(c.term, 'All', selectedAcademicYear)).length
                  : courses.filter((c) => courseMatchesQuarter(c.term, q, selectedAcademicYear)).length;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSelectedQuarter(q)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-chip)] transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-accent text-white shadow-subtle'
                        : 'text-muted hover:text-tx-primary hover:bg-surface'
                    }`}
                  >
                    <span>{q === 'All' ? 'All' : q}</span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active Quarter" />}
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface-3 text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar filter */}
          <div className="p-2 border-b border-subtle bg-surface flex-shrink-0">
            <Input
              size="xs"
              placeholder="Search course title or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<Search className="w-3.5 h-3.5 stroke-[1.75] text-muted" />}
            />
          </div>

          {/* Assignment Status Filter Pills */}
          <div className="px-2 py-1.5 border-b border-subtle bg-surface-2 flex items-center gap-1 overflow-x-auto custom-scrollbar flex-shrink-0">
            <button
              type="button"
              onClick={() => setAssignmentFilter('all')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-[var(--radius-chip)] transition-colors cursor-pointer flex items-center space-x-1.5 ${
                assignmentFilter === 'all'
                  ? 'bg-accent text-white shadow-subtle'
                  : 'text-muted hover:text-tx-primary hover:bg-surface'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  assignmentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-surface-3 text-muted'
                }`}
              >
                {allAssignmentsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAssignmentFilter('pending')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-[var(--radius-chip)] transition-colors cursor-pointer flex items-center space-x-1.5 ${
                assignmentFilter === 'pending'
                  ? 'bg-warn text-white shadow-subtle'
                  : 'text-muted hover:text-tx-primary hover:bg-surface'
              }`}
            >
              <Clock className="w-3 h-3 stroke-[2]" />
              <span>Pending</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  assignmentFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-surface-3 text-muted'
                }`}
              >
                {pendingAssignmentsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAssignmentFilter('completed')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-[var(--radius-chip)] transition-colors cursor-pointer flex items-center space-x-1.5 ${
                assignmentFilter === 'completed'
                  ? 'bg-ok text-white shadow-subtle'
                  : 'text-muted hover:text-tx-primary hover:bg-surface'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 stroke-[2]" />
              <span>Submitted / Graded</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  assignmentFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-surface-3 text-muted'
                }`}
              >
                {completedAssignmentsCount}
              </span>
            </button>
          </div>

          {/* Course & Assignment List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 p-6 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-muted opacity-50" />
                <div className="text-xs font-semibold text-tx-primary">
                  {searchQuery ? 'No courses match your search' : 'No Courses Loaded'}
                </div>
                <Button
                  variant="filled"
                  size="sm"
                  loading={isSyncing}
                  onClick={handleSyncLms}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Sync LMS
                </Button>
              </div>
            ) : coursesToRender.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 p-4 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-muted opacity-50" />
                <div className="text-xs font-semibold text-tx-primary">
                  No {assignmentFilter === 'pending' ? 'pending' : 'submitted / graded'} assignments found
                </div>
                <p className="text-[11px] text-muted max-w-xs">
                  {assignmentFilter === 'pending'
                    ? 'All assignments for this view are submitted or graded.'
                    : 'No submitted assignments found for this view.'}
                </p>
                <Button variant="subtle" size="xs" onClick={() => setAssignmentFilter('all')}>
                  Show All Assignments
                </Button>
              </div>
            ) : (
              coursesToRender.map((course) => {
                const isCourseSelected = selectedCourse?.id === course.id;
                const displayedAssignments = (course.assignments || []).filter((assignment) => {
                  if (assignmentFilter === 'pending') return assignment.status === 'pending';
                  if (assignmentFilter === 'completed') {
                    return assignment.status === 'submitted' || assignment.status === 'graded';
                  }
                  return true;
                });

                return (
                  <div
                    key={course.id}
                    className={`rounded-[var(--radius-control)] border transition-all ${
                      isCourseSelected
                        ? 'bg-surface border-subtle shadow-subtle'
                        : 'bg-surface/50 border-subtle/50 hover:bg-surface hover:border-subtle'
                    }`}
                  >
                    {/* Course Header */}
                    <div
                      onClick={() => {
                        setSelectedCourse(course);
                        if (displayedAssignments.length > 0) {
                          setSelectedAssignment(displayedAssignments[0]);
                        } else if (course.assignments && course.assignments[0]) {
                          setSelectedAssignment(course.assignments[0]);
                        } else {
                          setSelectedAssignment(null);
                        }
                      }}
                      className="p-2.5 cursor-pointer flex items-start justify-between select-none"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: course.color || 'var(--accent)' }}
                          />
                          <span className="text-[11px] font-mono font-bold text-tx-primary">
                            {course.code}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-tx-primary mt-0.5 truncate">
                          {course.title}
                        </h4>
                        <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1.5 truncate">
                          <span className="font-mono text-accent font-semibold">{course.term}</span>
                          <span>•</span>
                          <span className="truncate">{course.schedule || 'On-Demand'}</span>
                        </div>
                      </div>

                      <Tag tone="neutral" variant="soft" className="text-[9px]">
                        {assignmentFilter === 'all'
                          ? `${course.assignments?.length || 0} Tasks`
                          : `${displayedAssignments.length} / ${course.assignments?.length || 0}`}
                      </Tag>
                    </div>

                    {/* Course Assignments List */}
                    {displayedAssignments.length > 0 && (
                      <div className="px-2 pb-2 space-y-1">
                        {displayedAssignments.map((assignment) => {
                          const isAssignmentSelected = selectedAssignment?.id === assignment.id;
                          const isGraded = assignment.status === 'graded';
                          const isSubmitted = assignment.status === 'submitted';

                          return (
                            <div
                              key={assignment.id}
                              onClick={() => {
                                setSelectedCourse(course);
                                setSelectedAssignment(assignment);
                                setSubmissionSuccess(false);
                                setPickedFile(null);
                              }}
                              className={`p-2 rounded-[var(--radius-chip)] flex items-center justify-between text-xs cursor-pointer transition-colors border ${
                                isAssignmentSelected
                                  ? 'bg-accent-soft text-accent border-accent/30 font-semibold'
                                  : 'bg-surface-2 text-tx-primary border-subtle/60 hover:bg-elevated'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0 pr-1">
                                {isGraded ? (
                                  <Award className="w-3.5 h-3.5 stroke-[2] flex-shrink-0 text-accent" />
                                ) : isSubmitted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2] flex-shrink-0 text-ok" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0 text-warn" />
                                )}
                                <span className="truncate text-[11px]">
                                  {assignment.title}
                                </span>
                              </div>

                              <span
                                className={`text-[9px] font-mono flex-shrink-0 px-1 py-0.2 rounded font-semibold ${
                                  isGraded
                                    ? 'bg-accent-soft text-accent'
                                    : isSubmitted
                                    ? 'bg-ok-soft text-ok'
                                    : 'bg-warn-soft text-warn'
                                }`}
                              >
                                {isGraded
                                  ? (assignment.weight || 'Graded')
                                  : isSubmitted
                                  ? 'Submitted'
                                  : (assignment.due_text || assignment.dueText || 'Due')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Pane: Viewing Assignment Details, Reading PDFs & HW Upload */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              {selectedCourse && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedCourse.color }}
                />
              )}
              <span className="lmsReaderTitle text-[12px] font-semibold text-tx-primary truncate tracking-tight">
                {selectedCourse
                  ? `${selectedCourse.code}: ${selectedAssignment ? selectedAssignment.title : selectedCourse.title}`
                  : 'Courses & LMS Workspace'}
              </span>
              {selectedCourse && (
                <button
                  type="button"
                  onClick={() => {
                    const url = selectedAssignment
                      ? `https://lms.s.isct.ac.jp/2025/mod/assign/view.php?id=${selectedAssignment.id}`
                      : `https://lms.s.isct.ac.jp/2025/course/view.php?id=${selectedCourse.id}`;
                    api.openUrl(url);
                  }}
                  className="p-1 rounded text-muted hover:text-tx-primary hover:bg-surface transition-colors cursor-pointer shrink-0"
                  title="Open in LMS (Browser)"
                  aria-label="Open in LMS"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              )}
            </div>

            {/* Segmented Workspace Tabs */}
            {selectedCourse && (
              <div className="flex items-center space-x-1 bg-surface p-0.5 rounded-[var(--radius-chip)] border border-subtle flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('instructions')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors cursor-pointer ${
                    activeTab === 'instructions'
                      ? 'bg-accent text-white shadow-subtle'
                      : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                  }`}
                >
                  Instructions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-accent text-white shadow-subtle'
                      : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                  }`}
                >
                  HW Upload
                </button>
              </div>
            )}
          </header>

          {/* Main Content Area */}
          {!selectedCourse ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted space-y-3 bg-surface">
              <GraduationCap className="w-10 h-10 text-accent opacity-60" />
              <div className="text-xs font-semibold text-tx-primary">No Course Selected</div>
              <Button
                variant="filled"
                size="sm"
                loading={isSyncing}
                onClick={handleSyncLms}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Sync LMS
              </Button>
            </div>
          ) : (
            <>
              {/* Tab 1: Assignment Overview / Instructions */}
              {activeTab === 'instructions' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 bg-surface">
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <div className="flex items-center space-x-2 text-xs text-muted font-mono mb-1">
                        <span>{selectedCourse.code}</span>
                        <span>•</span>
                        <span>{selectedCourse.term}</span>
                        {selectedCourse.room && selectedCourse.room !== 'Science Tokyo LMS' && (
                          <>
                            <span>•</span>
                            <span>{selectedCourse.room}</span>
                          </>
                        )}
                      </div>
                      <h1 className="text-lg font-bold text-tx-primary tracking-tight">
                        {selectedAssignment ? selectedAssignment.title : selectedCourse.title}
                      </h1>
                    </div>

                    {/* Metadata Strip */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-surface-2 rounded-[var(--radius-control)] border border-subtle">
                      <div>
                        <span className="text-[10px] text-muted block font-medium">Due Date</span>
                        <span className="text-xs font-semibold text-tx-primary mt-0.5 block">
                          {selectedAssignment ? (selectedAssignment.due_date || selectedAssignment.dueDate || 'TBA') : 'Semester'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block font-medium">Status</span>
                        <span
                          className={`text-xs font-semibold mt-0.5 block capitalize flex items-center gap-1.5 ${
                            selectedAssignment?.status === 'graded'
                              ? 'text-accent'
                              : selectedAssignment?.status === 'submitted'
                              ? 'text-ok'
                              : 'text-warn'
                          }`}
                        >
                          {selectedAssignment ? (
                            <>
                              {selectedAssignment.status === 'graded' && <Award className="w-3.5 h-3.5 stroke-[2]" />}
                              {selectedAssignment.status === 'submitted' && <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />}
                              {selectedAssignment.status === 'pending' && <Clock className="w-3.5 h-3.5 stroke-[2]" />}
                              <span>{selectedAssignment.status}</span>
                            </>
                          ) : (
                            'Active'
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block font-medium">Evaluation / Grade</span>
                        <span
                          className={`text-xs font-semibold mt-0.5 block truncate ${
                            selectedAssignment?.status === 'graded'
                              ? 'text-accent font-bold'
                              : selectedAssignment?.status === 'submitted'
                              ? 'text-ok font-medium'
                              : 'text-tx-primary'
                          }`}
                        >
                          {selectedAssignment?.weight || 'Coursework'}
                        </span>
                      </div>
                    </div>

                    {/* Description & Instructions */}
                    <div className="space-y-4 text-xs leading-relaxed text-tx-primary">
                      {/* Attached Handouts & Reference Files Card */}
                      {(() => {
                        const handouts = parseHandouts(selectedAssignment?.handout_name || selectedAssignment?.handoutName);
                        if (handouts.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <h3 className="font-semibold text-xs text-tx-primary flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5 text-accent stroke-[2]" />
                              Attached Handouts & Reference Files ({handouts.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {handouts.map((h, i) => (
                                <a
                                  key={i}
                                  href={h.url || '#'}
                                  target={h.url ? '_blank' : undefined}
                                  rel={h.url ? 'noopener noreferrer' : undefined}
                                  onClick={(e) => {
                                    if (!h.url) e.preventDefault();
                                  }}
                                  className={`p-2.5 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-center justify-between text-xs transition-colors ${
                                    h.url
                                      ? 'hover:border-accent/40 hover:bg-elevated cursor-pointer group'
                                      : 'opacity-80 cursor-default'
                                  }`}
                                  title={h.url ? `Open ${h.name}` : h.name}
                                >
                                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                                    <FileText className="w-4 h-4 text-accent flex-shrink-0 stroke-[1.75]" />
                                    <span className="truncate font-medium text-tx-primary group-hover:text-accent transition-colors">
                                      {h.name}
                                    </span>
                                  </div>
                                  {h.url && (
                                    <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-accent flex-shrink-0" />
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <h3 className="font-semibold text-xs text-tx-primary mb-1.5">Description & Guidelines</h3>
                        <div className="p-4 rounded-[var(--radius-control)] bg-surface-2 border border-subtle whitespace-pre-wrap font-sans text-xs leading-relaxed text-tx-primary">
                          {selectedAssignment?.description || (
                            <span className="text-muted italic">
                              Course content for {selectedCourse.title}. Refer to the official Science Tokyo LMS portal for detailed files and syllabi.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick action buttons */}
                      {selectedAssignment && (
                        <div className="pt-2 flex items-center gap-3">
                          <Button
                            variant="filled"
                            size="sm"
                            onClick={() => setActiveTab('upload')}
                          >
                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                            Submit Homework
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: HW Upload & Submission Component */}
              {activeTab === 'upload' && selectedAssignment && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 bg-surface">
                  <div className="max-w-xl mx-auto space-y-5">
                    <div>
                      <h2 className="text-sm font-bold text-tx-primary tracking-tight">
                        Homework Upload & LMS Submission
                      </h2>
                      <p className="text-xs text-muted mt-1">
                        Submitting to <span className="font-semibold text-tx-primary">{selectedCourse.code}</span>: {selectedAssignment.title}
                      </p>
                    </div>

                    {/* Upload Dropzone */}
                    <div
                      onClick={handlePickFile}
                      className="border-2 border-dashed border-subtle hover:border-accent/60 rounded-[var(--radius-surface)] p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-surface-2/40 hover:bg-surface-2 transition-all block"
                    >
                      <UploadCloud className="w-10 h-10 stroke-[1.5] text-accent mb-2" />
                      <span className="text-xs font-semibold text-tx-primary">
                        {pickedFile ? pickedFile.name : 'Click to select file using OS dialog or drag & drop'}
                      </span>
                      <span className="text-[11px] text-muted mt-1">
                        Accepts PDF, ZIP, TAR.GZ, or source files
                      </span>
                    </div>

                    {/* File Selected Status Card */}
                    {pickedFile && (
                      <div className="p-3 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <FileCheck className="w-4 h-4 text-accent stroke-[1.75]" />
                          <div>
                            <div className="font-semibold text-tx-primary">{pickedFile.name}</div>
                            <div className="text-[10px] text-muted font-mono">
                              {(pickedFile.size / 1024).toFixed(1)} KB · Ready for upload
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="filled"
                          loading={isSubmitting}
                          onClick={handleRealSubmit}
                        >
                          Upload & Submit
                        </Button>
                      </div>
                    )}

                    {/* Submission Success Notice */}
                    {submissionSuccess && (
                      <div className="p-4 rounded-[var(--radius-control)] bg-ok-soft border border-ok/30 flex items-start space-x-3 text-xs text-ok">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 stroke-[2]" />
                        <div>
                          <div className="font-bold text-xs">Successfully Handed Off to Science Tokyo LMS</div>
                          <div className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                            {submissionMessage}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </ResizableWorkspace>
    </div>
  );
};
