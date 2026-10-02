// Short encouragement in Karina's coaching voice. One shows per day, the same for everyone.
export const QUOTES = [
  "Every great round starts with a quiet practice session. Show up today.",
  "Progress in golf is quiet. Trust the reps.",
  "You don't need a perfect practice. You need today's practice.",
  "Ten focused minutes beat an hour of just hitting balls.",
  "Mistakes are information. Read them, adjust, swing again.",
  "The putt you practice today is the one you make this weekend.",
  "Be patient with your swing and proud of your effort.",
  "Small changes, done often, become your new normal.",
  "Practice with purpose. Play with freedom.",
  "Your short game is where strokes quietly disappear.",
  "Every good player was once a beginner who kept going.",
  "Pick a target. Commit. Let it go.",
  "Good days and tough days both count. Keep showing up.",
  "Your body is part of your swing. Take care of it.",
  "Confidence is built one practice session at a time.",
  "Celebrate the good shots. Learn from the rest.",
  "Slow it down to speed it up.",
  "Today's homework is tomorrow's personal best.",
  "Stay curious about your game. Ask questions, try things.",
  "Breathe, trust your routine, and swing.",
  "The range is where you build it. The course is where you trust it.",
  "Consistency beats intensity.",
  "You're closer than you think. Keep going.",
  "Enjoy the process. That's where the fun is.",
  "One good habit this week is a win.",
  "Play the shot in front of you, not the last one.",
  "Effort is a skill too, and you're building it right now.",
  "Learn one new thing about your game today.",
  "A calm mind makes a better swing.",
  "Have fun out there. That's when you play your best."
];

export function quoteOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date - start) / 864e5);
  return QUOTES[(day + date.getFullYear()) % QUOTES.length];
}
