// Original, fictional sample content used by the live preview and by the database seeder.
// No real people, organisations or articles; pictures are generated artwork.
import { CORE_ARTICLES } from './sampleCore.js';
import { MORE_ARTICLES } from './sampleMore.js';
import { slugify, deriveTags } from './rules.js';

export const DEMO_PASSWORDS = { admin: 'admin123', editor: 'editor123', author: 'author123', reader: 'user123' };

export const SECTIONS = [
  ['World', 'Diplomacy, trade and events shaping regions around the globe.'],
  ['Technology', 'Software, devices and the people building them.'],
  ['Business', 'Markets, companies and the local economy.'],
  ['Science', 'Research, discoveries and the environment.'],
  ['Sports', 'Results, profiles and the stories behind the scoreboard.'],
  ['Culture', 'Books, film, food and the arts.'],
];

export const PEOPLE = [
  { key: 'alex', name: 'Alex Morgan', email: 'admin@example.com', role: 'admin', gender: 'male', bio: 'Publisher and managing editor. Sets the standards for corrections and sourcing.' },
  { key: 'casey', name: 'Casey Lin', email: 'editor@example.com', role: 'editor', gender: 'female', bio: 'Section editor for technology and science. Twelve years on the news desk.' },
  { key: 'dana', name: 'Dana Brooks', email: 'author@example.com', role: 'author', gender: 'female', bio: 'Reporter covering local government, transport and the riverside neighbourhoods.' },
  { key: 'eli', name: 'Eli Ford', email: 'eli@example.com', role: 'author', gender: 'male', bio: 'Sports and culture writer. Believes every match report needs a good first line.' },
  { key: 'jamie', name: 'Jamie Rivera', email: 'user@example.com', role: 'reader', gender: 'female', bio: '' },
];

// Generated artwork as a data URI (an original illustration, nothing is downloaded).
export function artSvg(seed, label = '', hue = 210) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return (h % 1000) / 1000 * n; };
  const dots = Array.from({ length: 6 }, () => `<circle cx="${Math.round(r(800))}" cy="${Math.round(r(450))}" r="${Math.round(50 + r(150))}" fill="#fff" opacity="${(0.07 + r(0.14)).toFixed(2)}"/>`).join('');
  const y = Math.round(260 + r(100));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 65% 20%)"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/>${dots}<path d="M0 ${y} C200 ${y - 70} 420 ${y + 60} 800 ${y - 30} L800 450 L0 450Z" fill="#000" opacity=".2"/><text x="40" y="410" font-family="Georgia,serif" font-size="44" fill="#fff" opacity=".85">${String(label).replace(/[<>&"]/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const MARKET_POLL = { question: 'Should the Saturday market stay at the riverside?', options: [{ id: 'yes', label: 'Yes, keep it there' }, { id: 'both', label: 'Run both sites' }, { id: 'no', label: 'Move it back downtown' }], closesAt: null, votes: { yes: 46, both: 21, no: 9 } };

const EXTRAS = [
  {
    section: 'World', kind: 'live', breaking: true, author: 'dana', views: 2450, hoursAgo: 3, featured: true,
    title: 'Live: Storm Marlo reaches the coast',
    summary: 'Follow the latest on flooding, ferry cancellations and road closures as the storm moves across the bay.',
    description: 'Storm Marlo made landfall on the eastern shore this morning. This page is updated as new information arrives from the emergency office, the transport authority and our reporters on the ground.\n\n## Before you travel\n\n- Check the ferry timetable before leaving home\n- Avoid the coast road between Pier Street and the lighthouse\n- Schools in the flood zone are closed today',
    tags: ['storm', 'weather', 'flooding'],
    live: [
      [170, 'Emergency office: the river barrier at Harborview is closed. Residents in the lowest streets have been asked to move cars to higher ground.', true, false],
      [135, 'Ferry crossings to the northern islands are cancelled for the rest of the day. The operator will review the timetable tomorrow morning.', false, false],
      [95, 'Reporter on the promenade: waves are reaching the railings and the lower car park is under about half a metre of water.', false, false],
      [60, 'The tram line is running every 15 minutes instead of every 6. Buses on the coast road are diverted via Mill Lane.', true, false],
      [35, 'Shelters opened at the sports hall and the library. Both have space, hot drinks and charging points.', false, true],
      [12, 'Wind speeds have started to ease. The weather service expects the worst to pass by early evening, with rain continuing overnight.', false, false],
    ],
  },
  {
    section: 'Business', kind: 'opinion', author: 'dana', views: 1180, daysAgo: 2,
    title: 'Opinion: Free bus fares would pay for themselves',
    summary: 'Cheaper, fuller buses mean fewer cars downtown. A columnist argues the council should run the numbers properly.',
    description: 'Every winter the council debates whether to make the bus free for a month. Every spring it concludes the money is better spent elsewhere. I think the question is framed the wrong way round.\n\n## The hidden bill\n\nCongestion costs shops customers, delays deliveries and keeps buses slower than they should be. None of that appears in the transport budget, yet all of it is paid for.\n\n> A bus that arrives often and costs nothing is a service people stop thinking about, and that is the point.\n\nThe pilot should be measured on more than fare income: traffic counts, shop footfall and the time it takes a bus to cross the old town.',
    tags: ['transport', 'buses', 'opinion'],
  },
  {
    section: 'Technology', kind: 'analysis', author: 'casey', views: 1420, daysAgo: 1,
    title: 'Analysis: What the open data portal could change for riders',
    summary: 'Open timetables and delay records are only useful if someone builds on them. Here is what to watch in the first year.',
    description: 'The council has voted to publish live transit data. The decision is the easy part. The value comes from what people build with it.\n\n## Three things to watch\n\n1. **Quality of the feed.** A feed that lags behind reality is worse than no feed.\n2. **Licence terms.** Developers will only commit if the data stays open.\n3. **Accessibility.** Lift outages and step-free routes should be part of the data from day one.\n\nCities that published similar data saw small, specialised apps appear first: a bus tracker for a single route, a school-run planner, a tool for wheelchair users.',
    tags: ['transport', 'open-data', 'analysis'],
  },
  {
    section: 'Sports', kind: 'fact-check', author: 'eli', views: 960, daysAgo: 3,
    title: 'Fact check: did the city marathon really double in size?',
    summary: 'A viral post says this year\'s race is twice as big as last year\'s. The registration records tell a different story.',
    description: 'A widely shared post claims the city marathon "doubled in size" this year. We compared the organisers\' registration lists for both years.\n\n## What the records show\n\nLast year 7,400 runners registered. This year the figure is 9,200, an increase of about 24 per cent. The new wheelchair division added 180 entries, which explains part of the rise.\n\n## Verdict\n\nThe race is the largest on record but it did not double. The claim is mostly false.',
    tags: ['marathon', 'fact-check'], factCheck: { claim: 'The city marathon doubled in size this year.', rating: 'mostly-false' },
  },
  {
    section: 'Business', kind: 'sponsored', author: 'alex', views: 410, daysAgo: 4, sponsor: 'Harbor Cooperative Bank',
    title: 'Sponsored: saving for a first workshop, step by step',
    summary: 'A guide from Harbor Cooperative Bank on setting aside small monthly amounts for a first business premises.',
    description: 'This article was paid for by Harbor Cooperative Bank and was not written by the newsroom.\n\n## Start small\n\nPick an amount you will not miss and automate it on payday. Even a modest monthly sum builds a deposit faster than most people expect.\n\n## Know your costs\n\nList rent, insurance, utilities and tools before you look at premises. A realistic budget is the best argument you can bring to a lender.',
    tags: ['savings', 'small-business'],
  },
  {
    section: 'Culture', kind: 'news', author: 'eli', views: 1320, daysAgo: 2, featured: false, gallery: true,
    title: 'Photo essay: a morning at the riverside market',
    summary: 'Six pictures from the first hour of trading, when the stalls are set up and the light is still low.',
    description: 'Traders arrive before sunrise to set up. By seven the first customers are queueing for bread, and by eight the promenade smells of coffee and fresh herbs.\n\nThe pictures below are illustrations made for this essay.',
    tags: ['market', 'photography', 'riverside'],
    galleryItems: [['Stalls waiting for the first customers', 'Awnings go up while the river is still grey.'], ['Fresh bread in baskets', 'The bakery cooperative brings its first van at six.'], ['A fruit stall at sunrise', 'Late summer plums, sold by the paper bag.'], ['Coffee cart on the promenade', 'The queue starts forming at seven.'], ['A cheese seller weighing a wedge', 'Regulars know the stall by its blue scales.'], ['Empty crates stacked for the afternoon', 'By noon the best produce is gone.']],
  },
  {
    section: 'Science', kind: 'news', author: 'casey', views: 1750, daysAgo: 2,
    title: 'Watch: the restored marsh from above',
    summary: 'A drone flight over the Harborview wetland shows how the channels and bird islands have taken shape.',
    description: 'Two years after the first spade went into the ground, the Harborview wetland looks very different. The video below follows the main channel from the old sea wall to the bird islands.\n\nThe player loads only when you press play, and it uses the privacy-enhanced mode that sets no tracking cookies until then.',
    tags: ['wetland', 'video', 'birds'], embed: { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', title: 'Sample embedded video' },
  },
  // ---- editorial workflow examples -------------------------------------------------------------
  { section: 'Culture', status: 'draft', author: 'dana', views: 0, daysAgo: 0, title: 'Draft: Summer film season preview', summary: 'A first look at the films opening at the riverside cinema this summer.', description: 'Notes for the preview:\n\n- Confirm the opening date with the cinema\n- Add a quote from the programmer\n- Check the film list before publishing' },
  { section: 'World', status: 'submitted', author: 'eli', views: 0, daysAgo: 0, title: 'Council budget hearing: what to expect on Thursday', summary: 'Residents can speak for three minutes each. Here is the running order and how to sign up.', description: 'The council will hear public comments on next year\'s budget on Thursday evening.\n\n## Running order\n\n1. Opening statement from the finance chair\n2. Public comments, three minutes each\n3. Questions from councillors\n\nSign-up opens at the town hall at five o\'clock.' },
  {
    section: 'Science', status: 'in_review', author: 'dana', editor: 'casey', views: 0, daysAgo: 0, title: 'School meals pilot reports its first results',
    summary: 'Pupils at six schools ate more vegetables and wasted less food during the first term of the pilot.', description: 'The pilot, which swapped fixed menus for a choice of two hot meals, finished its first term this week.\n\n## Early numbers\n\n- Vegetable portions eaten per pupil rose by a fifth\n- Food waste fell by about a quarter\n- Queue times were unchanged\n\nThe council will decide in spring whether to extend the pilot.',
    notes: [{ by: 'casey', type: 'comment', body: 'Good structure. Please add the number of pupils who took part before I approve.', hoursAgo: 5 }],
  },
  {
    section: 'World', status: 'changes_requested', author: 'eli', editor: 'casey', views: 0, daysAgo: 0, title: 'Bridge repair timetable explained',
    summary: 'The Mill Street bridge closes for six weeks. What changes for drivers, cyclists and bus routes.', description: 'The Mill Street bridge will close on the first Monday of next month for structural repairs.\n\nBuses will be diverted along Station Road.',
    notes: [{ by: 'casey', type: 'changes', body: 'The cyclist and pedestrian detour is missing, and we need the contractor\'s name and the end date from the council notice.', hoursAgo: 20 }],
  },
  { section: 'Culture', status: 'approved', author: 'eli', editor: 'casey', views: 0, daysAgo: 0, title: 'Autumn lantern parade route announced', summary: 'The parade leaves the library at dusk and ends at the riverside bandstand.', description: 'This year\'s lantern parade follows a new route so that the whole of the old town can watch.\n\n## The route\n\n- Library steps, 6 pm\n- Market Square\n- Riverside promenade\n- Bandstand finale', notes: [{ by: 'casey', type: 'comment', body: 'Approved. Schedule for Friday morning.', hoursAgo: 2 }] },
  { section: 'Technology', status: 'scheduled', author: 'dana', views: 0, hoursAhead: 52, title: 'Scheduled: new bus app launches next week', summary: 'The transport authority will release its journey planner to the public on Monday.', description: 'The transport authority will release its journey planner to the public next week.\n\nThis article is scheduled and will appear on the site automatically at the chosen time.' },
  { section: 'World', status: 'archived', author: 'dana', views: 640, daysAgo: 330, title: 'Archived: last year\'s harvest festival results', summary: 'Winners of the cheese race, the pie contest and the scarecrow competition.', description: 'Last year\'s harvest festival drew record crowds to the valley villages.\n\n## Winners\n\n- Cheese race: the Alder Farm team\n- Pie contest: Marta Soler\n- Scarecrow competition: the Little Skerry school' },
];

const DECOR = {
  'Weekend market moves to the riverside after ten years downtown': { poll: MARKET_POLL, tags: ['market', 'riverside', 'traders'] },
  'Riverton Rovers clinch the league title on the final day': { headlineB: 'Late goal gives Rovers their first league title in 40 years', ab: { a: { impressions: 142, clicks: 17 }, b: { impressions: 139, clicks: 26 } }, breaking: false },
  'City council approves open data portal for public transit': { tags: ['transport', 'open-data', 'council'], history: [{ daysAgo: 1.5, by: 'dana', note: 'First version', override: { title: 'Council backs plan for transit data portal', summary: 'Bus and tram timetables will be published as open data.', description: 'The council of Riverton voted on Tuesday to publish live transit information through a public data portal.' } }, { daysAgo: 1.2, by: 'casey', note: 'Tightened the headline, added the vote count', override: { description: 'The council of Riverton voted 9 to 2 on Tuesday to publish live transit information through a public data portal, ending months of debate about cost and privacy.' } }] },
};

const COMMENT_SAMPLES = [
  [0, 'Priya', 'Good news for anyone who commutes by tram. I hope the feed includes cancellations as well as delays.', 'approved', 1, null],
  [0, 'Tomas', 'Will the data be available as a simple download for people who are not developers?', 'approved', 1, null],
  [0, 'Dana Brooks', 'Yes. The council says there will be a plain CSV download next to the live feed.', 'approved', 0.8, 1],
  [1, 'Hannah', 'I volunteered at the planting weekend last year. Seeing the birds come back makes it worth it.', 'approved', 2, null],
  [2, 'Marcus', 'What a final day. I was in the stand and the noise when the goal went in was unreal.', 'approved', 3, null],
  [4, 'Elena', 'Just finished it. Read it in one sitting and then went for a long walk.', 'approved', 4, null],
  [3, 'Sam', 'Do the bakeries deliver to cafes outside the old town?', 'pending', 0, null],
  [5, 'Ben', 'Can the sensor data be downloaded as a CSV file?', 'pending', 0, null],
  [2, 'Spammer', 'Buy cheap watches at my website now!!! best price', 'pending', 0, null, 4],
];

export const SAMPLE_SUBSCRIBERS = [
  { email: 'reader.one@example.com', topics: [], confirmed: true, daysAgo: 20 },
  { email: 'reader.two@example.com', topics: ['Technology', 'Science'], confirmed: true, daysAgo: 12 },
  { email: 'reader.three@example.com', topics: ['Sports'], confirmed: true, daysAgo: 6 },
  { email: 'reader.four@example.com', topics: [], confirmed: false, daysAgo: 1 },
];

const AUTHOR_CYCLE = ['dana', 'eli', 'casey', 'dana', 'eli', 'alex'];

// Deterministic views-per-day for the last 14 days (feeds trending and the analytics charts).
export function dailyViews(index, total, now = Date.now()) {
  const out = {};
  for (let d = 0; d < 14; d++) {
    const key = new Date(now - d * 86400000).toISOString().slice(0, 10);
    const weight = 0.6 + (((index * 7 + d * 3) % 5) / 5) * 0.8;
    out[key] = Math.max(0, Math.round((total / 14) * weight * (d < 4 ? 1.5 : 0.8) * (index % 7 === 0 && d < 2 ? 2.2 : 1)));
  }
  return out;
}

const hueOf = (section) => ({ World: 212, Technology: 262, Business: 28, Science: 168, Sports: 142, Culture: 330 }[section] ?? 200);

// Everything needed to seed a store, with symbolic references (section name, person key, article slug).
export function buildSampleContent(now = Date.now()) {
  const H = 3600000;
  const D = 86400000;
  const articles = [];
  [...CORE_ARTICLES, ...MORE_ARTICLES].forEach(([section, title, summary, description, views, featured, daysAgo], i) => {
    const decor = DECOR[title] || {};
    articles.push({
      section, title, summary, description, views, featured, status: 'published', kind: 'news', author: AUTHOR_CYCLE[i % AUTHOR_CYCLE.length],
      publishedAt: new Date(now - daysAgo * D - (i % 5) * H).toISOString(), tags: decor.tags || deriveTags(title), ...decor,
    });
  });
  EXTRAS.forEach((e) => {
    const at = e.hoursAhead ? now + e.hoursAhead * H : now - (e.hoursAgo !== undefined ? e.hoursAgo * H : (e.daysAgo || 0) * D);
    const status = e.status || 'published';
    const a = {
      kind: 'news', featured: false, status, publishedAt: ['published', 'scheduled', 'archived'].includes(status) ? new Date(at).toISOString() : null,
      tags: e.tags || deriveTags(e.title), ...e,
    };
    if (e.gallery) {
      a.gallery = e.galleryItems.map(([alt, caption], i) => ({ src: artSvg(`${e.title}${i}`, alt.split(' ').slice(0, 3).join(' '), hueOf(e.section) + i * 12), alt, caption }));
      a.image = a.gallery[0].src;
      a.imageAlt = a.gallery[0].alt;
    }
    delete a.galleryItems;
    delete a.hoursAgo; delete a.daysAgo; delete a.hoursAhead;
    articles.push(a);
  });
  for (const a of articles) {
    a.slug = slugify(a.title);
    if (!a.createdAt) a.createdAt = new Date((a.publishedAt ? Date.parse(a.publishedAt) : now) - 2 * H).toISOString();
  }
  const comments = COMMENT_SAMPLES.map(([ai, name, body, status, daysAgo, parent, reports]) => ({
    article: articles[ai].slug, name, body, status, createdAt: new Date(now - daysAgo * D - H).toISOString(), parentIndex: parent, reports: reports || 0,
  }));
  return { sections: SECTIONS.map(([name, description], order) => ({ name, description, order })), people: PEOPLE, articles, comments, subscribers: SAMPLE_SUBSCRIBERS, hueOf };
}
