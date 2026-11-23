import type { Article } from '../lib/types'

const img = (prompt: string) =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=landscape_4_3`

const iso = (daysAgo: number) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return t.toISOString().slice(0, 10)
}

const mk = (a: Omit<Article, 'date' | 'publishedAt'> & { daysAgo: number }): Article => {
  const date = iso(a.daysAgo)
  const { daysAgo, ...rest } = a
  return { ...rest, date, publishedAt: date + 'T07:00:00Z' }
}

export const DEMO_ARTICLES: Article[] = [
  mk({
    id: 'demo-15min',
    daysAgo: 0,
    category: 'politics',
    difficulty: 'medium',
    title: 'Cities Rethink the Fifteen-Minute Neighborhood',
    image: img('a calm European city street with bicycles, small shops, morning light, editorial photography'),
    source: 'Demo Daily',
    url: 'https://example.com/15-minute-city',
    minutes: 3,
    paragraphs: [
      'For decades, many cities were designed around the car. Homes sat far from offices, and a simple trip to buy milk could mean a twenty-minute drive. Now a growing number of planners are asking a different question: what if everything you need were within a fifteen-minute walk?',
      'The idea is often called the fifteen-minute city. It does not mean that people never leave their neighborhood. Instead, it means that schools, clinics, parks, cafés and workplaces should be close enough that daily life does not depend on driving.',
      'Supporters say the model cuts traffic and pollution, and it gives local shops a better chance to survive. Critics worry that richer neighborhoods will improve quickly while poorer ones are left behind, and that some jobs simply cannot move closer to home.',
      'In practice, change is slow. A city might start by widening a sidewalk, adding a bus line or turning an empty lot into a small park. None of these steps sounds dramatic, but together they can quietly reshape how a neighborhood feels.'
    ]
  }),
  mk({
    id: 'demo-shortfilms',
    daysAgo: 0,
    category: 'entertainment',
    difficulty: 'easy',
    title: 'Why Short Films Are Winning New Fans',
    image: img('a small independent cinema with warm lights and a few audience members, cinematic'),
    source: 'Demo Daily',
    url: 'https://example.com/short-films',
    minutes: 2,
    paragraphs: [
      'A short film usually lasts less than thirty minutes. For years, these films were shown mainly at festivals. Today, more people watch them on their phones during a lunch break.',
      'The reason is simple. A short film tells a complete story in a small amount of time. There is no long setup. The first scene has to catch your attention, and the last scene has to stay in your mind.',
      'Young directors like the form because it is cheap to make. A team of five friends can shoot a short film in a weekend. If the idea works, it may open the door to a bigger project.',
      'For viewers, the appeal is variety. In one evening you can watch a quiet family drama, a strange science fiction story and a funny animation. Each one is a small experiment, and that is exactly what makes them exciting.'
    ]
  }),
  mk({
    id: 'demo-womensfootball',
    daysAgo: 0,
    category: 'sports',
    difficulty: 'medium',
    title: "The Quiet Rise of Women's Football",
    image: img("women's football match in a packed stadium, players competing, dynamic sports photography"),
    source: 'Demo Daily',
    url: 'https://example.com/womens-football',
    minutes: 3,
    paragraphs: [
      "Ten years ago, many women's football matches were played in front of almost empty stands. Players often trained part-time and kept second jobs. This season, several leagues are reporting record crowds and record television audiences.",
      'The change did not happen overnight. Clubs invested in youth programs, schools began to offer more places for girls, and broadcasters slowly agreed to show more matches. Each step was small, but they added up.',
      'Money is still a problem. Top players can now earn a living from the game, yet many others still cannot. Training facilities are often shared, and medical support is sometimes thinner than in the men\'s game.',
      'Still, the direction is clear. Sponsors are interested, families are buying tickets, and young girls now have players they can watch every week. That visibility may be the most important change of all.'
    ]
  }),
  mk({
    id: 'demo-delivery',
    daysAgo: 1,
    category: 'economy',
    difficulty: 'medium',
    title: 'Small Shops Learn to Live With Delivery Apps',
    image: img('a small neighborhood grocery store with delivery bags at the counter, warm afternoon light'),
    source: 'Demo Daily',
    url: 'https://example.com/shops-delivery',
    minutes: 3,
    paragraphs: [
      'When delivery apps first arrived, many small shop owners were suspicious. The apps promised more customers, but they also took a share of every order and asked shops to follow strict rules about timing and packaging.',
      'A few years later, the picture is more complicated. Some shops say the apps saved them during quiet months. Others complain that the fees are too high and that customers now expect everything in thirty minutes.',
      'The smartest owners treat the app as one channel among several. They use it to sell popular items, but they keep their regular customers through a simple message group. They also adjust prices so that the app fee does not swallow the profit.',
      'Economists say this pattern is common. A new technology rarely destroys an industry in one blow. Instead, it forces every business to decide what it is really good at, and to protect that part carefully.'
    ]
  }),
  mk({
    id: 'demo-octopus',
    daysAgo: 1,
    category: 'science',
    difficulty: 'hard',
    title: 'Octopuses May Dream, Scientists Say',
    image: img('an octopus underwater with changing skin colors, deep blue ocean, macro photography'),
    source: 'Demo Daily',
    url: 'https://example.com/octopus-dream',
    minutes: 4,
    paragraphs: [
      'Octopuses are strange in almost every way. They have three hearts, blue blood and skin that can change color in less than a second. They can solve puzzles, open jars and recognize individual people. Now some researchers suspect they may also dream.',
      'In a recent study, scientists filmed sleeping octopuses and recorded sudden bursts of color and movement. These bursts look similar to the animals\' hunting behavior when they are awake. The pattern suggests that the sleeping brain may be replaying recent experiences.',
      'This is not proof of dreams, and researchers are careful about the word. A dream, in the human sense, involves a story that the mind creates. What octopuses may have is something simpler: a sleeping brain that continues to process what it learned during the day.',
      'The question matters because it challenges a comfortable assumption. For a long time, complex sleep was thought to belong only to animals with a backbone. If an octopus shares some of these patterns, then the story of sleep may be far older than we imagined.'
    ]
  }),
  mk({
    id: 'demo-walk',
    daysAgo: 2,
    category: 'life',
    difficulty: 'easy',
    title: 'The Case for Walking After Dinner',
    image: img('people walking on a quiet tree-lined street at dusk, soft golden light, lifestyle photo'),
    source: 'Demo Daily',
    url: 'https://example.com/walk-after-dinner',
    minutes: 2,
    paragraphs: [
      'Many of us finish dinner and sit down on the sofa. It feels natural, especially after a long day. But a short walk after eating may be one of the easiest habits you can build.',
      'Doctors say a gentle walk helps the body move sugar out of the blood. It does not need to be fast or long. Ten or fifteen minutes is enough to make a difference.',
      'The walk has another benefit that is harder to measure. It gives your mind a clear break between work and rest. You see the street, you hear the evening, and for a few minutes you are not looking at a screen.',
      'The habit is easy to start and easy to keep, because it asks for so little. You do not need special shoes or a gym. You only need to stand up and open the door.'
    ]
  }),
  mk({
    id: 'demo-aitutor',
    daysAgo: 2,
    category: 'ai',
    difficulty: 'medium',
    title: 'AI Tutors Enter the Classroom',
    image: img('a student using a tablet with a friendly AI interface in a bright modern classroom'),
    source: 'Demo Daily',
    url: 'https://example.com/ai-tutors',
    minutes: 3,
    paragraphs: [
      'A new kind of teaching assistant is appearing in schools. It is not a person but a program. Students type a question, and the system answers in clear language, often asking a follow-up question to check understanding.',
      'Teachers report mixed results. The tools are good at explaining a rule again in a different way, and they never lose patience. That can help a student who is afraid to ask the same question twice.',
      'The risks are also real. A program can sound confident while being wrong. It may also do too much of the thinking for the student, leaving them with answers but no skill.',
      'Most schools are therefore treating AI as a helper rather than a replacement. The teacher still decides what matters, notices when a child is struggling, and builds the trust that no program can fake.'
    ]
  }),
  mk({
    id: 'demo-leaves',
    daysAgo: 3,
    category: 'science',
    difficulty: 'easy',
    title: 'Why Autumn Leaves Turn Red',
    image: img('red and orange autumn leaves on a tree branch, soft sunlight, close up nature photography'),
    source: 'Demo Daily',
    url: 'https://example.com/autumn-leaves',
    minutes: 2,
    paragraphs: [
      'In summer, most leaves are green. The green comes from a chemical that helps the tree turn sunlight into food. As the days get shorter, the tree begins to prepare for winter.',
      'The tree stops making the green chemical. When it fades, other colors that were hidden underneath begin to show. Yellow and orange appear first, because those colors were in the leaf all along.',
      'Red is different. Many trees actually make red color in autumn, using sugar that is still in the leaf. A sunny day and a cool night produce the brightest red.',
      'So the colors of autumn are not simply the leaves dying. They are a sign of a tree carefully closing down for the season, saving what it can and letting the rest go.'
    ]
  }),
  mk({
    id: 'demo-shipping',
    daysAgo: 3,
    category: 'politics',
    difficulty: 'hard',
    title: 'The Long Road to Cleaner Shipping',
    image: img('a large cargo ship at sea at sunrise, smoke from funnel, wide ocean view'),
    source: 'Demo Daily',
    url: 'https://example.com/clean-shipping',
    minutes: 4,
    paragraphs: [
      'Around ninety percent of the world\'s goods travel by sea. That makes shipping essential, and it also makes it difficult to clean up. A single large container ship can burn as much fuel in a day as a small town.',
      'Governments have agreed to cut emissions from ships, but the details are hard. Companies need new engines, new fuels and new ports to supply them. None of this can happen quickly, and no single country can force the change alone.',
      'Some progress is visible. A few ports now offer electricity to ships at the dock, so engines can be switched off. Designs for wind-assisted ships are being tested again, more than a century after sails disappeared.',
      'The deeper problem is cost. Cleaner fuel is more expensive, and shipping is a business with thin profits. Unless customers are willing to pay a little more, the industry will move slowly, one small agreement at a time.'
    ]
  }),
  mk({
    id: 'demo-coffee',
    daysAgo: 4,
    category: 'life',
    difficulty: 'medium',
    title: 'The Slow Return of the Neighborhood Café',
    image: img('a cozy neighborhood cafe interior with wooden tables and plants, morning light through window'),
    source: 'Demo Daily',
    url: 'https://example.com/neighborhood-cafe',
    minutes: 3,
    paragraphs: [
      'For a while, it seemed that coffee would become a thing you ordered on an app and drank while walking. Then something unexpected happened. Small cafés began to fill up again, and not only with people who wanted a drink.',
      'Owners say the change is about space rather than coffee. In a city where flats are small and many people work from home, a café offers a table, a chair and a reason to leave the house. It is a quiet room shared with strangers.',
      'The economics remain difficult. Rent is high, and a café cannot survive on one drink per customer. Many owners now host small events in the evening, from book clubs to language exchanges, to turn a place that sells coffee into a place people belong to.',
      'What the best cafés sell, in the end, is a feeling of being expected. Someone knows your order. Someone asks how your week went. That is hard to put in a cup.'
    ]
  })
]
