export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ContestRound = 1 | 2 | 3 | 4 | 5; // 1: Loại, 2: Trường, 3: Phường, 4: Tỉnh, 5: Quốc gia

export type QuestionType = 'tn' | 'noi' | 'dt' | 'sx'; // Trắc nghiệm, Nối vế, Điền từ, Sắp xếp câu

export type ExamSourceType = 'github' | 'custom' | 'merged' | 'test';

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id: string; // e.g., l4_c2_tn_0001
  grade: GradeLevel;
  round: ContestRound;
  roundName?: string;
  type: QuestionType;
  topic?: string;
  question: string;
  options?: string[]; // For 'tn' (Multiple choice)
  correct?: string | string[]; // For 'tn', 'dt', 'sx'
  matchingPairs?: MatchingPair[]; // For 'noi' (left item paired with its correct right text)
  rightOptions?: string[]; // For 'noi' (shuffled/ordered right column choices to display)
  scrambledWords?: string[]; // For 'sx'
  explanation?: string;
  audioText?: string;
  source?: ExamSourceType;
}

export interface GitHubFileEntry {
  grade: GradeLevel;
  round: ContestRound;
  filename: string;
  path: string;
  rawUrl: string;
}

export interface GitHubRepoIndex {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  files: GitHubFileEntry[];
  availableMap: Record<string, GitHubFileEntry>; // key: "l4_c2"
  loadedAt: string;
  apiLimited?: boolean;
}

export interface LoadedExamPool {
  grade: GradeLevel;
  round: ContestRound;
  questions: Question[];
  source: ExamSourceType;
  sourceLabel: string;
  fileName?: string;
  typeCounts: Record<QuestionType, number>;
}

export interface RoundCountSummary {
  round: ContestRound;
  count: number;
  isTestOnly: boolean;
  source: ExamSourceType;
  typeCounts: Record<QuestionType, number>;
}

export interface ExamConfig {
  studentName: string;
  accountId?: string;
  isAdminMode?: boolean;
  parentEmail?: string;
  parentEmailPassword?: string;
  grade: GradeLevel;
  round: ContestRound;
  questionCount: number; // e.g. 20, 50, 100, 200
  timeLimitSeconds: number; // default 1800s (30 mins)
  minStudyMinutes?: number;
  parentPin?: string;
  source?: ExamSourceType;
  sourceFileName?: string;
}

export interface UserAnswer {
  questionId: string;
  userAnswer: string | Record<string, string> | string[];
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface ExamResultData {
  id: string;
  studentName: string;
  grade: GradeLevel;
  round: ContestRound;
  roundName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  completedAt: string;
  answers: UserAnswer[];
  incorrectQuestions: {
    question: Question;
    userAnswer: any;
  }[];
  aiAnalysis?: string;
  source?: ExamSourceType;
  sourceFileName?: string;
  questions?: Question[];
}

export interface GitHubRepoConfig {
  enabled: boolean;
  url: string;
}
