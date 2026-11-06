import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  FileCheck,
  Download,
  ZoomIn,
  ZoomOut,
  GraduationCap,
  Layers,
  Search,
} from 'lucide-react';
import { ResizableWorkspace } from '../ResizableWorkspace';
import { Tag, Button, Input } from '../ui/controls';

interface Course {
  id: string;
  code: string;
  title: string;
  instructor: string;
  schedule: string;
  room: string;
  color: string;
  assignments: Assignment[];
}

interface Assignment {
  id: string;
  title: string;
  dueText: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded';
  weight: string;
  description: string;
  handoutName: string;
}

const COURSES_DATA: Course[] = [
  {
    id: 'cs301',
    code: 'CS.301',
    title: 'Operating Systems Internals',
    instructor: 'Prof. S. Tanaka',
    schedule: 'Mon / Thu 10:45 - 12:15',
    room: 'West Bldg 8 - Room 301',
    color: '#2f5fd0',
    assignments: [
      {
        id: 'cs301-a1',
        title: 'Project 2: Virtual Memory & Page Replacement',
        dueText: 'Due in 2 days',
        dueDate: 'Nov 8, 23:59 JST',
        status: 'pending',
        weight: '15% of final grade',
        description:
          'Implement demand paging, FIFO and CLOCK page replacement algorithms in the xv6 educational operating system kernel. Measure TLB miss rates under synthetic memory workloads.',
        handoutName: 'cs301_project2_spec.pdf',
      },
      {
        id: 'cs301-a2',
        title: 'Problem Set 3: Concurrency & Semaphores',
        dueText: 'Due Nov 15',
        dueDate: 'Nov 15, 23:59 JST',
        status: 'pending',
        weight: '10% of final grade',
        description:
          'Solve classical synchronization problems using POSIX semaphores and mutex locks. Provide formal proof of deadlock freedom.',
        handoutName: 'cs301_pset3.pdf',
      },
    ],
  },
  {
    id: 'ai420',
    code: 'AI.420',
    title: 'Machine Learning & Reasoning',
    instructor: 'Prof. K. Sato',
    schedule: 'Tue / Fri 09:00 - 10:30',
    room: 'Midorigaoka Bldg 1 - Room 102',
    color: '#8a5a0b',
    assignments: [
      {
        id: 'ai420-a1',
        title: 'Lab 4: Diffusion Models & Variational Inference',
        dueText: 'Submitted',
        dueDate: 'Nov 4, 18:00 JST',
        status: 'submitted',
        weight: '20% of final grade',
        description:
          'Train a Denoising Diffusion Probabilistic Model (DDPM) on CIFAR-10 from scratch using PyTorch. Report Frechet Inception Distance (FID) metrics.',
        handoutName: 'ai420_lab4_diffusion.pdf',
      },
    ],
  },
  {
    id: 'ph210',
    code: 'PH.210',
    title: 'Quantum Mechanics & Modern Physics',
    instructor: 'Prof. H. Ito',
    schedule: 'Wed 13:30 - 15:00',
    room: 'South Bldg 4 - Room 201',
    color: '#24733f',
    assignments: [
      {
        id: 'ph210-a1',
        title: 'Midterm Report: Wavepacket Tunneling Analysis',
        dueText: 'Due Nov 22',
        dueDate: 'Nov 22, 17:00 JST',
        status: 'pending',
        weight: '25% of final grade',
        description:
          'Numerically solve the time-dependent Schrodinger equation for a Gaussian wavepacket incident on a finite rectangular potential barrier.',
        handoutName: 'ph210_tunneling_report.pdf',
      },
    ],
  },
  {
    id: 'ma315',
    code: 'MA.315',
    title: 'Stochastic Processes & Optimization',
    instructor: 'Prof. Y. Nakamura',
    schedule: 'Fri 13:30 - 15:00',
    room: 'West Bldg 5 - Room 104',
    color: '#b3382b',
    assignments: [
      {
        id: 'ma315-a1',
        title: 'Problem Set 4: Markov Decision Processes',
        dueText: 'Due Nov 19',
        dueDate: 'Nov 19, 23:59 JST',
        status: 'pending',
        weight: '10% of final grade',
        description:
          'Formulate Bellman optimality equations and apply policy iteration to inventory control models.',
        handoutName: 'ma315_pset4_mdp.pdf',
      },
    ],
  },
];

export const CoursesWorkspace: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course>(COURSES_DATA[0]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment>(COURSES_DATA[0].assignments[0]);
  const [activeTab, setActiveTab] = useState<'instructions' | 'pdf' | 'upload'>('instructions');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [submittedFile, setSubmittedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const filteredCourses = COURSES_DATA.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmittedFile(e.target.files[0]);
    }
  };

  const handleSimulatedSubmit = () => {
    if (!submittedFile) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionSuccess(true);
    }, 1200);
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
                Courses & Tokyo LMS
              </span>
            </div>

            <Tag tone="accent" variant="soft">
              2026 Fall (3Q)
            </Tag>
          </header>

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

          {/* Course & Assignment List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filteredCourses.map((course) => {
              const isCourseSelected = selectedCourse.id === course.id;
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
                      if (course.assignments[0]) {
                        setSelectedAssignment(course.assignments[0]);
                      }
                    }}
                    className="p-2.5 cursor-pointer flex items-start justify-between select-none"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: course.color }}
                        />
                        <span className="text-[11px] font-mono font-bold text-tx-primary">
                          {course.code}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-tx-primary mt-0.5 truncate">
                        {course.title}
                      </h4>
                      <div className="text-[10px] text-muted mt-0.5 truncate">
                        {course.instructor} · {course.room}
                      </div>
                    </div>

                    <Tag tone="neutral" variant="soft" className="text-[9px]">
                      {course.assignments.length} Tasks
                    </Tag>
                  </div>

                  {/* Course Assignments List */}
                  <div className="px-2 pb-2 space-y-1">
                    {course.assignments.map((assignment) => {
                      const isAssignmentSelected = selectedAssignment.id === assignment.id;
                      const isPending = assignment.status === 'pending';

                      return (
                        <div
                          key={assignment.id}
                          onClick={() => {
                            setSelectedCourse(course);
                            setSelectedAssignment(assignment);
                            setSubmissionSuccess(false);
                            setSubmittedFile(null);
                          }}
                          className={`p-2 rounded-[var(--radius-chip)] flex items-center justify-between text-xs cursor-pointer transition-colors border ${
                            isAssignmentSelected
                              ? 'bg-accent-soft text-accent border-accent/30 font-semibold'
                              : 'bg-surface-2 text-tx-primary border-subtle/60 hover:bg-elevated'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0 pr-1">
                            {isPending ? (
                              <Clock className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0 text-warn" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0 text-ok" />
                            )}
                            <span className="truncate text-[11px]">
                              {assignment.title}
                            </span>
                          </div>

                          <span
                            className={`text-[9px] font-mono flex-shrink-0 px-1 py-0.2 rounded ${
                              isPending
                                ? 'bg-warn-soft text-warn font-semibold'
                                : 'bg-ok-soft text-ok'
                            }`}
                          >
                            {assignment.dueText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Pane: Viewing Assignment Details, Reading PDFs & HW Upload */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedCourse.color }}
              />
              <span className="lmsReaderTitle text-[12px] font-semibold text-tx-primary truncate tracking-tight">
                {selectedCourse.code}: {selectedAssignment.title}
              </span>
            </div>

            {/* Segmented Workspace Tabs */}
            <div className="flex items-center space-x-1 bg-surface p-0.5 rounded-[var(--radius-chip)] border border-subtle flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('instructions')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeTab === 'instructions'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                Instructions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeTab === 'pdf'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                Handout PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                HW Upload
              </button>
            </div>
          </header>

          {/* Subheader Metadata Banner */}
          <div className="px-4 py-2 bg-surface border-b border-subtle flex items-center justify-between text-xs flex-shrink-0">
            <div className="flex items-center space-x-3 text-muted">
              <span>{selectedCourse.title}</span>
              <span>·</span>
              <span className="font-mono text-tx-primary font-semibold">
                Deadline: {selectedAssignment.dueDate}
              </span>
              <span>·</span>
              <span className="text-[11px] text-accent font-medium">
                {selectedAssignment.weight}
              </span>
            </div>

            <Tag
              tone={selectedAssignment.status === 'submitted' ? 'ok' : 'warn'}
              variant="soft"
            >
              {selectedAssignment.status === 'submitted' ? 'Submitted' : 'Pending Submission'}
            </Tag>
          </div>

          {/* Tab 1: Assignment Details & Problem Statement */}
          {activeTab === 'instructions' && (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 bg-surface space-y-5">
              <div className="max-w-3xl space-y-4">
                <div>
                  <h2 className="text-base font-bold text-tx-primary tracking-tight">
                    {selectedAssignment.title}
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Course: {selectedCourse.title} ({selectedCourse.code}) · {selectedCourse.instructor}
                  </p>
                </div>

                <div className="p-3.5 rounded-[var(--radius-control)] bg-surface-2 border border-subtle space-y-2">
                  <h3 className="text-xs font-semibold text-tx-primary flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-accent stroke-[1.75]" />
                    <span>Project Overview & Requirements</span>
                  </h3>
                  <p className="text-xs text-tx-primary leading-relaxed">
                    {selectedAssignment.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-tx-primary uppercase tracking-wider text-muted">
                    Submission Guidelines
                  </h3>
                  <ul className="text-xs text-tx-primary space-y-1.5 list-disc pl-5">
                    <li>Submit all source code files and your analysis report as a single compressed archive (<code className="font-mono bg-surface-3 px-1 py-0.5 rounded text-[11px]">.zip</code> or <code className="font-mono bg-surface-3 px-1 py-0.5 rounded text-[11px]">.tar.gz</code>).</li>
                    <li>Include a comprehensive <code className="font-mono bg-surface-3 px-1 py-0.5 rounded text-[11px]">README.md</code> detailing execution flags and environment dependencies.</li>
                    <li>All benchmarks must be reproducible on the Science Tokyo campus Linux compute cluster.</li>
                  </ul>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <Button
                    variant="filled"
                    onClick={() => setActiveTab('upload')}
                    leftSection={<UploadCloud className="w-4 h-4 stroke-[1.75]" />}
                  >
                    Go to HW Upload
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setActiveTab('pdf')}
                    leftSection={<FileText className="w-4 h-4 stroke-[1.75]" />}
                  >
                    View Handout PDF
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Document / Handout PDF Previewer */}
          {activeTab === 'pdf' && (
            <div className="flex-1 min-h-0 flex flex-col bg-surface-2 overflow-hidden">
              {/* PDF Viewer Bar */}
              <div className="h-9 px-4 bg-surface border-b border-subtle flex items-center justify-between text-xs flex-shrink-0 select-none">
                <div className="flex items-center space-x-2 text-muted">
                  <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span className="font-mono text-[11px] text-tx-primary font-medium">
                    {selectedAssignment.handoutName}
                  </span>
                  <span>(Page 1 of 4)</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                    className="p-1 rounded text-muted hover:text-tx-primary hover:bg-surface-3 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                  <span className="text-[11px] font-mono text-muted w-10 text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(180, z + 10))}
                    className="p-1 rounded text-muted hover:text-tx-primary hover:bg-surface-3 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                  <button
                    type="button"
                    className="ml-2 flex items-center space-x-1 px-2 py-0.5 rounded-[var(--radius-chip)] bg-surface-3 hover:bg-elevated text-tx-primary text-[11px] font-semibold border border-subtle transition-colors"
                  >
                    <Download className="w-3 h-3 stroke-[1.75]" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* PDF Document Canvas Mock */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 flex justify-center bg-canvas">
                <div
                  className="bg-surface border border-subtle shadow-panel rounded-[var(--radius-surface)] p-8 max-w-2xl w-full min-h-[600px] space-y-4 text-xs text-tx-primary transition-transform duration-150 origin-top"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  <div className="border-b border-subtle pb-3">
                    <div className="text-[10px] font-mono uppercase text-muted tracking-widest">
                      Tokyo Institute of Technology / Institute of Science Tokyo
                    </div>
                    <h1 className="text-base font-bold text-tx-primary mt-1">
                      {selectedCourse.code}: {selectedCourse.title}
                    </h1>
                    <div className="text-xs text-muted mt-0.5">
                      {selectedAssignment.title} · Assignment Specification Handout
                    </div>
                  </div>

                  <div className="space-y-3 leading-relaxed text-tx-primary">
                    <p className="font-semibold text-xs">1. Problem Formulation & Objectives</p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      This assignment evaluates system-level proficiency in process synchronization, virtual memory isolation, and kernel concurrency primitives. Students are expected to formulate rigorous tests demonstrating high-load stability and zero race conditions under multi-core scheduling.
                    </p>

                    <p className="font-semibold text-xs mt-3">2. Evaluation Benchmark Criteria</p>
                    <div className="p-3 bg-surface-2 rounded-[var(--radius-chip)] border border-subtle font-mono text-[11px] space-y-1">
                      <div>Benchmark A: TLB Hit/Miss Ratio with 64KB page footprint</div>
                      <div>Benchmark B: Contention latency with 16 parallel threads</div>
                      <div>Benchmark C: Graceful out-of-memory handling without kernel panic</div>
                    </div>

                    <p className="font-semibold text-xs mt-3">3. Deliverables</p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Submit your completed source code repository along with performance graphs generated by Python matplotlib/seaborn. Compress into a single zip archive and upload through the HW Upload tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: HW Upload & Submission Component */}
          {activeTab === 'upload' && (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 bg-surface">
              <div className="max-w-xl mx-auto space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-tx-primary tracking-tight">
                    Homework Upload & LMS Submission
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Direct assignment handoff to the official Science Tokyo LMS portal.
                  </p>
                </div>

                {/* Student Verification Pill */}
                <div className="p-3 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-4 h-4 stroke-[1.75] text-accent" />
                    <div>
                      <span className="font-semibold text-tx-primary">Tokyo Tech Student Verification: </span>
                      <span className="font-mono text-muted">22B30142 (A. Al-Ali)</span>
                    </div>
                  </div>
                  <Tag tone="ok" variant="soft">
                    Verified
                  </Tag>
                </div>

                {/* Upload Dropzone */}
                <label className="border-2 border-dashed border-subtle hover:border-accent/60 rounded-[var(--radius-surface)] p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-surface-2/40 hover:bg-surface-2 transition-all block">
                  <UploadCloud className="w-10 h-10 stroke-[1.5] text-accent mb-2" />
                  <span className="text-xs font-semibold text-tx-primary">
                    {submittedFile ? submittedFile.name : 'Click to select file or drag & drop'}
                  </span>
                  <span className="text-[11px] text-muted mt-1">
                    Accepts .zip, .tar.gz, .pdf, .ipynb (Max: 50MB)
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* File Selected Status Card */}
                {submittedFile && (
                  <div className="p-3 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-accent stroke-[1.75]" />
                      <div>
                        <div className="font-semibold text-tx-primary">{submittedFile.name}</div>
                        <div className="text-[10px] text-muted font-mono">
                          {(submittedFile.size / 1024).toFixed(1)} KB · Ready for LMS handoff
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="filled"
                      loading={isSubmitting}
                      onClick={handleSimulatedSubmit}
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
                        Confirmation Token: <span className="font-mono font-semibold">TKY-LMS-2026-98421</span>. Your submission draft has been registered and verified on the server.
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous Submission Log */}
                <div className="pt-3 border-t border-subtle space-y-2">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Submission History
                  </span>
                  <div className="p-2.5 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ok stroke-[1.75]" />
                      <span className="text-[11px] text-tx-primary font-medium">
                        Initial Draft Submission
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">
                      Nov 3, 2026 · 14:22 JST
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </ResizableWorkspace>
    </div>
  );
};

export default CoursesWorkspace;
