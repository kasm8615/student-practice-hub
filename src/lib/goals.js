// Goal-setting guide shown to students and the goal fields.
export const GOAL_PERIODS = [
  ["m3", "Next 3 months"],
  ["m6", "Next 6 months"]
];

export const GOAL_FIELDS = [
  { k: "score", l: "Score goal", hint: "The result you're working toward.",
    ph: { m3: "e.g. Break 95 at my home course", m6: "e.g. Average 89 over 5 rounds" } },
  { k: "perf", l: "Performance goal", hint: "Stats you can measure and improve.",
    ph: { m3: "e.g. Hit 5 greens per round and keep putts under 34", m6: "e.g. 7 greens per round, no more than one 3-putt" } },
  { k: "mental", l: "Mental goal", hint: "How you want to think and feel on the course.",
    ph: { m3: "e.g. Use my full pre-shot routine on every shot", m6: "e.g. Reset after a bad hole with 3 deep breaths and a new target" } },
  { k: "process", l: "Practice habit", hint: "What you'll do every week to get there.",
    ph: { m3: "e.g. Practice 3 times a week and log every session", m6: "e.g. 20 minutes of putting before every round" } }
];

export const GOAL_GUIDE = `
  <p>Goals turn practice into progress. A 2022 review of goal-setting studies in sport found that setting goals improves performance, and that the most helpful goals are the ones about <b>what you do</b>, not just the score you want. Goals also work best when you set them <b>together with your coach</b>, so Karina will review yours and add her feedback.</p>
  <ul class="gtypes">
    <li><b>Score goals</b> give you a target, like breaking 90. They motivate you, but you don't fully control them.</li>
    <li><b>Performance goals</b> are the stats behind the score: greens, fairways, putts. Use the calculator below to see what your score goal takes.</li>
    <li><b>Mental goals</b> are about focus and composure: your routine, your self-talk, how you bounce back.</li>
    <li><b>Practice habits</b> are the actions you control 100%. Research shows these "process" goals help the most.</li>
  </ul>
  <p class="gtip">Make each goal specific and a little challenging, with a number or an action you can check.</p>`;
