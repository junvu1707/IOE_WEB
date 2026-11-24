import {
  Question,
  GradeLevel,
  ContestRound,
  QuestionType,
  ExamSourceType,
  GitHubFileEntry,
  GitHubRepoIndex,
  LoadedExamPool,
  MatchingPair,
} from '../types';

export const DEFAULT_GITHUB_REPO = 'https://github.com/junvu1707/IOE_de';
export const DEFAULT_GITHUB_BRANCH = 'main';

const STORAGE_KEYS = {
  GITHUB_URL: 'oly_github_url',
  CUSTOM_JSON: 'oly_custom_json',
};

// Unique cache-buster per page load (refreshed when user clicks Reload from GitHub)
let sessionCacheNonce = Date.now();

// In-memory cache for fetched GitHub files during current session
const githubFileCache = new Map<string, Question[]>();
let cachedRepoIndex: GitHubRepoIndex | null = null;

const TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ['Colors', 'Numbers', 'School things', 'Animals', 'Family members', 'Toys'],
  2: ['My classroom', 'My body', 'My pets', 'Food & Drink', 'At the zoo', 'My house'],
  3: ['My friends', 'My school', 'Our new things', 'My hobbies', 'My family', 'Our school playground'],
  4: ['Our school', 'My friends', 'My timetable', 'When is Sports Day?', 'My hobbies', 'Our local area'],
  5: ['Family', 'Daily routines', 'Free time activities', 'Our school subjects', 'Famous places', 'The environment'],
  6: ['My new school', 'My house', 'My friends', 'My neighborhood', 'Natural wonders', 'Tet holiday'],
  7: ['Hobbies', 'Health', 'Community service', 'Music and arts', 'Food', 'Travel'],
  8: ['Sports and games', 'The environment', 'Inventions', 'Festivals', 'Traditions', 'Space'],
  9: ['Life stories', 'City life', 'Stress and pressure', 'Wonders of Viet Nam', 'Energy sources', 'Global success'],
};

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getExamKey(grade: GradeLevel, round: ContestRound): string {
  return `l${grade}_c${round}`;
}

export function getConfiguredGitHubUrl(): string {
  const saved = localStorage.getItem(STORAGE_KEYS.GITHUB_URL)?.trim();
  return saved || DEFAULT_GITHUB_REPO;
}

export interface ParsedGitHubTarget {
  mode: 'repo' | 'raw-file';
  owner?: string;
  repo?: string;
  branch?: string;
  rawFileUrl?: string;
  normalizedUrl: string;
}

export function parseGitHubTarget(inputUrl: string): ParsedGitHubTarget {
  const trimmed = (inputUrl || DEFAULT_GITHUB_REPO).trim();

  // Direct JSON file URL (e.g., raw.githubusercontent.com/.../*.json)
  if (/\.json(\?.*)?$/i.test(trimmed)) {
    return {
      mode: 'raw-file',
      rawFileUrl: trimmed,
      normalizedUrl: trimmed,
    };
  }

  // GitHub repository URL: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch
  const ghMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/tree\/([^/\s#?]+))?\/?$/i
  );
  if (ghMatch) {
    const owner = ghMatch[1];
    const repo = ghMatch[2];
    const branch = ghMatch[3] || DEFAULT_GITHUB_BRANCH;
    return {
      mode: 'repo',
      owner,
      repo,
      branch,
      normalizedUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  // Shorthand owner/repo
  const shortMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      mode: 'repo',
      owner: shortMatch[1],
      repo: shortMatch[2],
      branch: DEFAULT_GITHUB_BRANCH,
      normalizedUrl: `https://github.com/${shortMatch[1]}/${shortMatch[2]}`,
    };
  }

  // Fallback to default repo
  return {
    mode: 'repo',
    owner: 'junvu1707',
    repo: 'IOE_de',
    branch: DEFAULT_GITHUB_BRANCH,
    normalizedUrl: DEFAULT_GITHUB_REPO,
  };
}

/**
 * Normalize a raw question JSON item from GitHub (IOE_de schema) or legacy custom JSON
 * into our unified Question interface.
 */
export function normalizeQuestion(
  raw: any,
  fallbackGrade?: GradeLevel,
  fallbackRound?: ContestRound,
  source: ExamSourceType = 'github'
): Question | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id || `q_${Math.random().toString(36).slice(2, 10)}`);

  // Infer grade, round, type from ID pattern like l4_c2_tn_0001 if fields are absent
  const idMatch = id.match(/^l(\d+)_c(\d+)_(tn|noi|dt|sx)/i);
  const parsedGrade = Number(raw.grade || (idMatch ? idMatch[1] : fallbackGrade || 4));
  const parsedRound = Number(raw.round || (idMatch ? idMatch[2] : fallbackRound || 1));
  const rawType = String(raw.type || (idMatch ? idMatch[3] : 'tn')).toLowerCase();

  if (parsedGrade < 1 || parsedGrade > 9) return null;
  if (parsedRound < 1 || parsedRound > 5) return null;
  if (!['tn', 'noi', 'dt', 'sx'].includes(rawType)) return null;

  const grade = parsedGrade as GradeLevel;
  const round = parsedRound as ContestRound;
  const type = rawType as QuestionType;

  const questionText = String(raw.question || '').trim();
  if (!questionText) return null;

  const normalized: Question = {
    id,
    grade,
    round,
    roundName: raw.round_name || raw.roundName,
    type,
    topic: raw.topic,
    question: questionText,
    explanation: raw.explanation,
    audioText: raw.audioText,
    source,
  };

  if (type === 'tn') {
    const options = Array.isArray(raw.options) ? raw.options.map(String) : [];
    const correctVal = raw.answer !== undefined ? raw.answer : raw.correct;
    normalized.options = options;
    normalized.correct = correctVal !== undefined ? String(correctVal) : '';
  } else if (type === 'dt') {
    const correctVal = raw.answer !== undefined ? raw.answer : raw.correct;
    normalized.correct = correctVal !== undefined ? String(correctVal) : '';
  } else if (type === 'sx') {
    const tokens = Array.isArray(raw.tokens)
      ? raw.tokens.map(String)
      : Array.isArray(raw.scrambledWords)
      ? raw.scrambledWords.map(String)
      : [];
    const correctVal = raw.answer !== undefined ? raw.answer : raw.correct;
    normalized.scrambledWords = tokens;
    normalized.correct = correctVal !== undefined ? String(correctVal) : '';
  } else if (type === 'noi') {
    if (Array.isArray(raw.left_items) && Array.isArray(raw.right_items) && Array.isArray(raw.answer_pairs)) {
      const rightMap = new Map<string, string>();
      raw.right_items.forEach((item: any) => {
        rightMap.set(String(item.key), String(item.text));
      });

      const answerMap = new Map<string, string>();
      raw.answer_pairs.forEach((pair: any) => {
        answerMap.set(String(pair.left), String(pair.right));
      });

      const pairs: MatchingPair[] = raw.left_items.map((leftItem: any) => {
        const leftKey = String(leftItem.key);
        const rightKey = answerMap.get(leftKey) || '';
        const rightText = rightMap.get(rightKey) || '';
        return {
          id: leftKey,
          left: String(leftItem.text),
          right: rightText,
        };
      });

      normalized.matchingPairs = pairs;
      normalized.rightOptions = raw.right_items.map((item: any) => String(item.text));
    } else if (Array.isArray(raw.matchingPairs)) {
      const pairs: MatchingPair[] = raw.matchingPairs.map((p: any, i: number) => ({
        id: String(p.id || `p${i + 1}`),
        left: String(p.left),
        right: String(p.right),
      }));
      normalized.matchingPairs = pairs;
      normalized.rightOptions = Array.isArray(raw.rightOptions)
        ? raw.rightOptions.map(String)
        : shuffleArray(pairs.map((p) => p.right));
    }
  }

  return normalized;
}

export function normalizeQuestionArray(
  data: any,
  fallbackGrade?: GradeLevel,
  fallbackRound?: ContestRound,
  source: ExamSourceType = 'github'
): Question[] {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.questions)
    ? data.questions
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const result: Question[] = [];
  for (const item of arr) {
    const q = normalizeQuestion(item, fallbackGrade, fallbackRound, source);
    if (q) result.push(q);
  }
  return result;
}

export function countQuestionTypes(questions: Question[]): Record<QuestionType, number> {
  const counts: Record<QuestionType, number> = { tn: 0, noi: 0, dt: 0, sx: 0 };
  for (const q of questions) {
    if (counts[q.type] !== undefined) {
      counts[q.type]++;
    }
  }
  return counts;
}

/**
 * Built-in Test Mode question bank (used when GitHub does not have a file for grade/round yet)
 */
export function generateDefaultQuestionBank(): Question[] {
  const bank: Question[] = [];
  const types: QuestionType[] = ['tn', 'noi', 'dt', 'sx'];

  for (let g = 1; g <= 9; g++) {
    const grade = g as GradeLevel;
    const topics = TOPICS_BY_GRADE[g] || ['General English'];

    for (let r = 1; r <= 5; r++) {
      const round = r as ContestRound;
      for (let i = 1; i <= 24; i++) {
        const type = types[(i - 1) % types.length];
        const topic = topics[(i + g) % topics.length];
        const paddedId = String(i).padStart(4, '0');
        const id = `l${grade}_c${round}_${type}_${paddedId}`;

        const qItem: Question = {
          id,
          grade,
          round,
          type,
          topic,
          question: '',
          explanation: `Giải thích mẫu (Test Mode) cho câu hỏi lớp ${grade}, vòng ${round} - chủ đề ${topic}.`,
          source: 'test',
        };

        if (type === 'tn') {
          if (grade <= 3) {
            qItem.question = `[Test Mode - ${topic}] Choose the correct English word for "Quả táo":`;
            qItem.options = ['Apple', 'Banana', 'Cat', 'Dog'];
            qItem.correct = 'Apple';
          } else if (grade <= 6) {
            qItem.question = `[Test Mode - ${topic}] He usually _____ to school every morning.`;
            qItem.options = ['go', 'goes', 'going', 'gone'];
            qItem.correct = 'goes';
          } else {
            qItem.question = `[Test Mode - ${topic}] If I were taller, I _____ play basketball better.`;
            qItem.options = ['will', 'would', 'can', 'may'];
            qItem.correct = 'would';
          }
        } else if (type === 'dt') {
          if (grade <= 3) {
            qItem.question = `[Test Mode - ${topic}] Fill in the missing letter: C _ T (con mèo)`;
            qItem.correct = 'A';
          } else if (grade <= 6) {
            qItem.question = `[Test Mode - ${topic}] Fill in the blank: She likes listening _____ music in her free time.`;
            qItem.correct = 'to';
          } else {
            qItem.question = `[Test Mode - ${topic}] Fill in the correct word form: Solar energy is environmentally _____ (FRIEND).`;
            qItem.correct = 'friendly';
          }
        } else if (type === 'sx') {
          if (grade <= 3) {
            qItem.question = `[Test Mode - ${topic}] Rearrange the words to make a correct sentence:`;
            qItem.scrambledWords = ['is', 'This', 'school.', 'my'];
            qItem.correct = 'This is my school.';
          } else if (grade <= 6) {
            qItem.question = `[Test Mode - ${topic}] Rearrange the words to form a meaningful sentence:`;
            qItem.scrambledWords = ['often', 'play', 'I', 'football', 'weekends.', 'on'];
            qItem.correct = 'I often play football on weekends.';
          } else {
            qItem.question = `[Test Mode - ${topic}] Rearrange the words into a complete sentence:`;
            qItem.scrambledWords = ['English', 'spoken', 'is', 'countries.', 'many', 'in'];
            qItem.correct = 'English is spoken in many countries.';
          }
        } else if (type === 'noi') {
          qItem.question = `[Test Mode - ${topic}] Match each question on the left with the correct answer on the right:`;
          qItem.matchingPairs = [
            { id: 'A', left: 'Hello, how are you?', right: 'I am fine, thank you.' },
            { id: 'B', left: 'What is your name?', right: 'My name is Nam.' },
            { id: 'C', left: 'Where are you from?', right: 'I am from Viet Nam.' },
          ];
          qItem.rightOptions = [
            'My name is Nam.',
            'I am from Viet Nam.',
            'I am fine, thank you.',
          ];
        }

        bank.push(qItem);
      }
    }
  }

  return bank;
}

const defaultTestBank: Question[] = generateDefaultQuestionBank();

export function getCustomQuestions(): Question[] {
  const customJsonStr = localStorage.getItem(STORAGE_KEYS.CUSTOM_JSON);
  if (!customJsonStr) return [];
  try {
    const parsed = JSON.parse(customJsonStr);
    return normalizeQuestionArray(parsed, undefined, undefined, 'custom');
  } catch (e) {
    console.warn('Invalid custom JSON in localStorage:', e);
    return [];
  }
}

export function clearGitHubCache(): void {
  githubFileCache.clear();
  cachedRepoIndex = null;
  sessionCacheNonce = Date.now();
}

/**
 * Discover all available l{grade}_c{round}.json files in the configured GitHub repository.
 * Runs automatically on web startup and whenever the user refreshes GitHub.
 */
export async function fetchGitHubRepoIndex(
  repoUrlOverride?: string,
  forceRefresh = false
): Promise<GitHubRepoIndex | null> {
  const url = repoUrlOverride || getConfiguredGitHubUrl();
  const target = parseGitHubTarget(url);

  if (target.mode !== 'repo' || !target.owner || !target.repo) {
    return null;
  }

  if (forceRefresh) {
    clearGitHubCache();
  }

  if (cachedRepoIndex && !forceRefresh && cachedRepoIndex.repoUrl === target.normalizedUrl) {
    return cachedRepoIndex;
  }

  const branch = target.branch || DEFAULT_GITHUB_BRANCH;
  const apiUrl = `https://api.github.com/repos/${target.owner}/${target.repo}/git/trees/${branch}?recursive=1`;

  try {
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) {
      // GitHub API rate-limited or branch mismatch: still return metadata so raw URLs work directly
      const fallbackIndex: GitHubRepoIndex = {
        repoUrl: target.normalizedUrl,
        owner: target.owner,
        repo: target.repo,
        branch,
        files: [],
        availableMap: {},
        loadedAt: new Date().toISOString(),
        apiLimited: true,
      };
      cachedRepoIndex = fallbackIndex;
      return fallbackIndex;
    }

    const data = await res.json();
    const tree = Array.isArray(data.tree) ? data.tree : [];
    const files: GitHubFileEntry[] = [];
    const availableMap: Record<string, GitHubFileEntry> = {};

    for (const entry of tree) {
      if (entry.type !== 'blob' || typeof entry.path !== 'string') continue;
      const filename = entry.path.split('/').pop() || entry.path;
      const match = filename.match(/^l([1-9])_c([1-5])\.json$/i);
      if (!match) continue;

      const grade = Number(match[1]) as GradeLevel;
      const round = Number(match[2]) as ContestRound;
      const key = getExamKey(grade, round);
      const rawUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${branch}/${entry.path}`;

      const fileEntry: GitHubFileEntry = {
        grade,
        round,
        filename,
        path: entry.path,
        rawUrl,
      };
      files.push(fileEntry);
      availableMap[key] = fileEntry;
    }

    files.sort((a, b) => (a.grade !== b.grade ? a.grade - b.grade : a.round - b.round));

    const index: GitHubRepoIndex = {
      repoUrl: target.normalizedUrl,
      owner: target.owner,
      repo: target.repo,
      branch,
      files,
      availableMap,
      loadedAt: new Date().toISOString(),
      apiLimited: false,
    };

    cachedRepoIndex = index;
    return index;
  } catch (err) {
    console.warn('Could not fetch GitHub repo tree, will still attempt direct raw JSON loads:', err);
    return {
      repoUrl: target.normalizedUrl,
      owner: target.owner,
      repo: target.repo,
      branch,
      files: [],
      availableMap: {},
      loadedAt: new Date().toISOString(),
      apiLimited: true,
    };
  }
}

/**
 * Fetch and normalize a raw JSON file from GitHub with cache-busting so new updates appear automatically.
 */
async function fetchRawGitHubJson(
  rawUrl: string,
  grade?: GradeLevel,
  round?: ContestRound
): Promise<Question[]> {
  const separator = rawUrl.includes('?') ? '&' : '?';
  const bustedUrl = `${rawUrl}${separator}t=${sessionCacheNonce}`;
  const res = await fetch(bustedUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  return normalizeQuestionArray(data, grade, round, 'github');
}

/**
 * Merge GitHub and user-uploaded questions into a single deduplicated pool
 * so random exam generation draws from both sources simultaneously.
 */
function mergeQuestionPools(githubQuestions: Question[], customQuestions: Question[]): Question[] {
  const merged: Question[] = [];
  const seenContent = new Set<string>();
  const usedIds = new Set<string>();

  const makeFingerprint = (q: Question): string => {
    const qText = q.question.trim().toLowerCase();
    const ans = q.type === 'noi' ? JSON.stringify(q.matchingPairs || []) : String(q.correct || '').trim().toLowerCase();
    return `${q.type}::${qText}::${ans}`;
  };

  for (const q of [...githubQuestions, ...customQuestions]) {
    const fp = makeFingerprint(q);
    if (seenContent.has(fp)) continue;
    seenContent.add(fp);

    let uniqueId = q.id;
    let suffix = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${q.id}_u${suffix++}`;
    }
    usedIds.add(uniqueId);

    merged.push(uniqueId === q.id ? q : { ...q, id: uniqueId });
  }

  return merged;
}

/**
 * Load the question pool for a specific Grade & Round.
 * Simultaneously combines GitHub Repo (l{grade}_c{round}.json) + Custom Uploaded/Pasted JSON,
 * falling back to Built-in Test Mode only when neither source has questions for this grade & round.
 */
export async function loadQuestionsForSelection(
  grade: GradeLevel,
  round: ContestRound,
  options?: {
    forceRefresh?: boolean;
    repoIndex?: GitHubRepoIndex | null;
    repoUrlOverride?: string;
  }
): Promise<LoadedExamPool> {
  const key = getExamKey(grade, round);
  const expectedFile = `${key}.json`;

  if (options?.forceRefresh) {
    githubFileCache.delete(key);
    sessionCacheNonce = Date.now();
  }

  // 1. Load Custom Uploaded/Pasted JSON matching grade & round
  const customQuestions = getCustomQuestions();
  const matchingCustom = customQuestions.filter((q) => q.grade === grade && q.round === round);

  // 2. Load GitHub questions matching grade & round
  let matchingGithub: Question[] = [];
  let githubFileName = expectedFile;
  let githubLabel = 'GitHub';

  const target = parseGitHubTarget(options?.repoUrlOverride || getConfiguredGitHubUrl());

  if (target.mode === 'raw-file' && target.rawFileUrl) {
    const cacheKey = `raw:${target.rawFileUrl}`;
    try {
      let rawQuestions = githubFileCache.get(cacheKey);
      if (!rawQuestions || options?.forceRefresh) {
        rawQuestions = await fetchRawGitHubJson(target.rawFileUrl);
        githubFileCache.set(cacheKey, rawQuestions);
      }
      matchingGithub = rawQuestions.filter((q) => q.grade === grade && q.round === round);
      githubFileName = target.rawFileUrl.split('/').pop() || 'questions.json';
      githubLabel = 'GitHub Raw JSON';
    } catch (err) {
      console.warn('Failed to fetch custom raw GitHub URL:', err);
    }
  } else if (target.mode === 'repo' && target.owner && target.repo) {
    const repoIndex = options?.repoIndex !== undefined ? options.repoIndex : cachedRepoIndex;
    const indexedEntry = repoIndex?.availableMap?.[key];

    const shouldAttemptFetch =
      options?.forceRefresh || !repoIndex || repoIndex.apiLimited || Boolean(indexedEntry);

    if (shouldAttemptFetch) {
      const rawUrl =
        indexedEntry?.rawUrl ||
        `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${
          target.branch || DEFAULT_GITHUB_BRANCH
        }/${expectedFile}`;

      const cacheKey = `${target.owner}/${target.repo}/${key}`;

      try {
        let ghQuestions = githubFileCache.get(cacheKey);
        if (!ghQuestions || options?.forceRefresh) {
          ghQuestions = await fetchRawGitHubJson(rawUrl, grade, round);
          if (ghQuestions.length > 0) {
            githubFileCache.set(cacheKey, ghQuestions);
          }
        }

        if (ghQuestions && ghQuestions.length > 0) {
          matchingGithub = ghQuestions;
          githubFileName = indexedEntry?.filename || expectedFile;
          githubLabel = `GitHub (${target.owner}/${target.repo})`;
        }
      } catch (err) {
        console.info(`No GitHub exam found at ${rawUrl}.`);
      }
    }
  }

  // 3. Combine BOTH sources simultaneously (GitHub + Custom Uploaded JSON)
  const combined = mergeQuestionPools(matchingGithub, matchingCustom);

  if (combined.length > 0) {
    const hasGithub = matchingGithub.length > 0;
    const hasCustom = matchingCustom.length > 0;
    const source: ExamSourceType = hasGithub && hasCustom ? 'merged' : hasGithub ? 'github' : 'custom';

    return {
      grade,
      round,
      questions: combined,
      source,
      sourceLabel:
        source === 'merged'
          ? `Kết hợp GitHub + File tải lên (${combined.length} câu)`
          : source === 'github'
          ? githubLabel
          : `File JSON tùy chỉnh (${combined.length} câu)`,
      fileName: hasGithub ? githubFileName : 'custom.json',
      typeCounts: countQuestionTypes(combined),
    };
  }

  // 4. Fallback to Test Mode only if both sources have no questions for this grade & round
  const testQuestions = defaultTestBank.filter((q) => q.grade === grade && q.round === round);
  return {
    grade,
    round,
    questions: testQuestions,
    source: 'test',
    sourceLabel: `Chế độ Test Mode (${testQuestions.length} câu)`,
    fileName: expectedFile,
    typeCounts: countQuestionTypes(testQuestions),
  };
}

/**
 * Stratified random selection: guarantees balanced mix of all available question types (tn, noi, dt, sx)
 * and zero duplicates whenever pool.length >= requestedCount.
 */
export function generateExamQuestions(
  poolQuestions: Question[],
  grade: GradeLevel,
  round: ContestRound,
  requestedCount: number = 200
): Question[] {
  let pool = poolQuestions.filter((q) => q.grade === grade && q.round === round);
  if (pool.length === 0) {
    pool = poolQuestions.length > 0 ? poolQuestions : defaultTestBank.filter((q) => q.grade === grade && q.round === round);
  }
  if (pool.length === 0) {
    pool = defaultTestBank;
  }

  // Group by question type for balanced sampling
  const byType: Record<QuestionType, Question[]> = {
    tn: shuffleArray(pool.filter((q) => q.type === 'tn')),
    noi: shuffleArray(pool.filter((q) => q.type === 'noi')),
    dt: shuffleArray(pool.filter((q) => q.type === 'dt')),
    sx: shuffleArray(pool.filter((q) => q.type === 'sx')),
  };

  const activeTypes = (['tn', 'noi', 'dt', 'sx'] as QuestionType[]).filter((t) => byType[t].length > 0);
  const selected: Question[] = [];

  if (pool.length >= requestedCount) {
    // Proportional allocation across all present types
    const totalPool = pool.length;
    const quotas: Record<QuestionType, number> = { tn: 0, noi: 0, dt: 0, sx: 0 };
    let allocated = 0;

    for (const t of activeTypes) {
      const exact = (byType[t].length / totalPool) * requestedCount;
      // Ensure at least 1 question of each present type if requestedCount >= activeTypes.length
      const qCount = Math.min(byType[t].length, Math.max(requestedCount >= activeTypes.length ? 1 : 0, Math.floor(exact)));
      quotas[t] = qCount;
      allocated += qCount;
    }

    // Distribute remaining slots proportionally to types that still have unused questions
    let remaining = requestedCount - allocated;
    const leftovers: Question[] = [];

    for (const t of activeTypes) {
      selected.push(...byType[t].slice(0, quotas[t]));
      leftovers.push(...byType[t].slice(quotas[t]));
    }

    if (remaining > 0 && leftovers.length > 0) {
      selected.push(...shuffleArray(leftovers).slice(0, remaining));
    }

    return shuffleArray(selected).slice(0, requestedCount);
  }

  // If pool has fewer questions than requestedCount (e.g., Test Mode with 24 questions for 200-question exam)
  const shuffledPool = shuffleArray(pool);
  let index = 0;
  while (selected.length < requestedCount && shuffledPool.length > 0) {
    const original = shuffledPool[index % shuffledPool.length];
    selected.push({
      ...original,
      id: index < shuffledPool.length ? original.id : `${original.id}_v${Math.floor(index / shuffledPool.length) + 1}`,
    });
    index++;
  }

  return selected;
}

/**
 * Helper for sentence-rearrangement (sx) comparison that tolerates minor punctuation/spacing quirks
 * (e.g., trailing comma inside a single token vs clean answer string).
 */
export function isSentenceAnswerCorrect(userSentence: string, expectedSentence: string): boolean {
  const normBasic = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normBasic(userSentence) === normBasic(expectedSentence)) {
    return true;
  }

  // Strip minor punctuation differences while preserving exact word order and apostrophes
  const normRelaxed = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  return normRelaxed(userSentence) === normRelaxed(expectedSentence) && normRelaxed(expectedSentence).length > 0;
}
