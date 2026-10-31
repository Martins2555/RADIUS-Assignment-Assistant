// ---- Access lock (free message limits + unlock codes) ----
// The "REQUEST FOR UNLOCK CODE" button opens your X profile (@RadiusMO) until you set
// X_USER_ID below. Once you have your numeric X user ID, paste it in as a
// string, e.g. '1234567890123456789'. The button then opens a ready DM with
// the message and the student's email already filled in.
const X_HANDLE = 'RadiusMO'

export const X_USER_ID = '1817816481905680385'

export function requestCodeUrl(email) {
  if (!X_USER_ID) return `https://x.com/${X_HANDLE}`
  const msg = `Hi, I'd like an unlock code for RADIUS. My account email is ${email || '(your email)'}. How do I pay?`
  return `https://x.com/messages/compose?recipient_id=${X_USER_ID}&text=${encodeURIComponent(msg)}`
}

const WHATSAPP_NUMBER = '2347013892555'

export function requestCodeWhatsappUrl(email) {
  const msg = `Hi, I'd like an unlock code for RADIUS. My account email is ${email || '(your email)'}. How do I pay?`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
}

// Must match the limit enforced in api/generate.js (check_rate_limit call).
export const HOURLY_LIMIT = 20

export const KIND_LABELS = { quiz: 'Quiz', summary: 'Summary', hint: 'Hint', solution: 'Solution', explain: 'Explanation', note: 'Note' }

export const TOOLS = [
  { id: 'chat', label: 'Assignment' },
  { id: 'notes', label: 'Study Pack' },
  { id: 'pastq', label: 'Past Qs' },
  { id: 'graph', label: 'Graph' },
  { id: 'cite', label: 'Citation' },
  { id: 'plan', label: 'Exam Plan' },
  { id: 'project', label: 'Project' },
]

export const TOOL_INFO = {
  notes: {
    title: 'Study Pack',
    summary: 'Turn messy lecture notes into clean notes, flashcards and a quiz.',
    steps: [
      'Paste your notes below, or attach photos or a PDF of them.',
      'Send it. RADIUS cleans up the notes and lists the key terms.',
      'You get tap-to-flip flashcards and a quiz that scores you.',
    ],
    tip: 'Tip: add the subject above for better results.',
  },
  pastq: {
    title: 'Past Question Trainer',
    summary: 'Find out what to read first and practise on the topics that keep showing up.',
    steps: [
      'Paste or attach past questions for one course.',
      'RADIUS maps the topics by how often they appear, ranks what to read first, and gives you 5 practice questions.',
      'Reply with your answers. RADIUS marks them and shows your weak topics.',
    ],
    tip: 'Tip: the more past papers you add, the better the topic map.',
  },
  graph: {
    title: 'Graph Mode',
    summary: 'Plot any equation or your own data as a clean, accurate graph.',
    steps: [
      'Type an equation like y = x^2 - 4x + 3, several equations, or paste your data points.',
      'RADIUS draws the graph with labelled axes, intercepts and turning points.',
      'Tap Explore to drag and zoom the graph, or Save image to share it.',
    ],
    tip: 'Example: "Plot sin(x) and cos(x) from -2pi to 2pi"',
  },
  cite: {
    title: 'Citation Fixer',
    summary: 'Get a correctly formatted reference from a link, title or DOI.',
    steps: [
      'Paste a link, book or article title, or DOI.',
      'Name a style (APA, Harvard, IEEE, MLA or Chicago). APA is used if you do not pick one.',
      'You get the reference entry and the in-text citation. Missing details are marked in [brackets], never made up.',
    ],
    tip: 'Example: "Harvard: https://example.com/my-article"',
  },
  plan: {
    title: 'Exam Planner',
    summary: 'Get a day-by-day study plan that fits your exam dates.',
    steps: [
      'List your exams, their dates, the topics, and how many hours you can study a day.',
      'RADIUS builds a day-by-day plan table, putting the sooner exams first.',
      'Missed a day or something changed? Tell RADIUS and it rebuilds the rest of the plan.',
    ],
    tip: 'Example: "Physics Oct 20, Maths Oct 25, 3 hours a day"',
  },
}

export const TOOL_PLACEHOLDERS = {
  chat: 'Type your assignment here...',
  notes: 'Paste or attach your lecture notes...',
  pastq: 'Paste or attach past questions for a course...',
  graph: 'Type an equation or paste data to plot...',
  cite: 'Paste a link, title, or DOI to get a reference...',
  plan: 'List your exams, dates, topics and hours per day...',
  project: 'Ask anything about your project material...',
}
