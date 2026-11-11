'use strict';

// Teaching copy is original. Technique ids are shared with logic.js; availability
// comes from the validated exercise bank, rather than from these descriptions.
const LESSONS = Object.freeze([
  {
    id: 'naked-single', label: '唯一候选数', tier: 0, summary: '看一个格：只有一个数字能填。',
    principle: '候选数记录一个空格在行、列、宫约束下仍可填写的数字。如果只剩一个候选，这个格的答案就确定了。',
    steps: ['观察空格中的候选数。', '找到只剩一个候选的格。', '选中该格，填写这个数字。'],
    mistakes: '候选数必须完整、可靠；不能因为自己只记了一个数，就认定它是答案。',
    example: { title: '看格子中的可能性', lines: ['A：{2,5}　B：{7}　C：{1,4}', 'B 只有候选 7，因此 B = 7。', 'A、C 暂时都不能直接确定。'] },
    action: 'place'
  },
  {
    id: 'hidden-single', label: '唯一位置', tier: 0, summary: '看一个区域：某数字只有一个位置。',
    principle: '同一行、列或宫必须包含 1 到 9。如果某数字只出现在其中一个空格的候选中，即使该格还有其他候选，也能确定答案。',
    steps: ['选一行、一列或一个宫。', '逐个数字寻找它的候选位置。', '只有一个位置时，将数字填入该格。'],
    mistakes: '找的是某个数字的唯一位置；该格不一定只有一个候选。必须检查完整的行、列或宫。',
    example: { title: '同一行中的候选', lines: ['A：{2,7}　B：{2,5}　C：{2,5}', '假设这一行的 7 只出现在 A。', '所以 A = 7，即使 A 也有候选 2。'] },
    action: 'place'
  },
  {
    id: 'pointing', label: '指向排除', tier: 1, summary: '从宫看出去：候选被锁在一条线。',
    principle: '某数字在一个宫中的全部候选位置，如果都位于同一行或同一列，那么这条行或列在宫外的其他格都不能再填写该数字。',
    steps: ['在一个宫中找同一数字的全部候选。', '确认它们都在同一行或同一列。', '删除这条线在宫外的同数字候选。'],
    mistakes: '必须检查宫内该数字的全部位置。只看到两个对齐的候选，而漏掉第三个，不能成立。',
    example: { title: '从宫指向一行', lines: ['左上宫的候选 6 只在第 2 行。', '第 2 行的 6 必须落在左上宫。', '可删除第 2 行宫外的候选 6。'] },
    action: 'eliminate'
  },
  {
    id: 'claiming', label: '认领排除', tier: 1, summary: '从线看进宫：候选被锁在一个宫。',
    principle: '某数字在一行或一列中的全部候选位置，如果都落在同一个宫内，那么这个宫在该行或列之外的其他格都不能再有该数字。',
    steps: ['在一行或一列中找某数字的全部候选。', '确认它们全部落入同一个宫。', '删除宫内、不在这条线上的同数字候选。'],
    mistakes: '认领从行或列出发，指向从宫出发。两者都要求候选位置被完整限制。',
    example: { title: '由一行认领一个宫', lines: ['第 4 行的候选 3 只在中间宫。', '中间宫的 3 必须落在第 4 行。', '删除该宫第 5、6 行中的候选 3。'] },
    action: 'eliminate'
  },
  {
    id: 'naked-pair', label: '显性数对', tier: 1, summary: '两个格，只容纳同样的两个数字。',
    principle: '同一行、列或宫里，如果两个空格都只有相同的两个候选，这两个数字就被这两格占据，可以从该区域其他格中删除。',
    steps: ['找同一区域内候选完全相同的两格。', '两格的候选都必须恰好是那两个数。', '从区域其他格中删除这两个候选。'],
    mistakes: '现在还不能判断两格各自填哪一个数。若其中一格多了第三个候选，就不是显性数对。',
    example: { title: '同一行的三个空格', lines: ['A：{2,7}　B：{2,7}　C：{2,5,7}', 'A、B 分别占据 2 和 7。', 'C 可删除 2、7，剩下 5。'] },
    action: 'eliminate'
  },
  {
    id: 'hidden-pair', label: '隐性数对', tier: 1, summary: '两个数字，只能落在同样的两格。',
    principle: '同一区域内，两个数字如果都只出现在相同的两个空格中，这两格必须留给它们。因此可以删除这两格中的其他候选。',
    steps: ['按数字寻找同一区域内的候选位置。', '找到只出现于同样两格的两个数字。', '保留这两格中的数对，删除其他候选。'],
    mistakes: '“两个格有这两个数”还不够；必须确认区域其他格完全没有这两个数。',
    example: { title: '数字的两个专属位置', lines: ['同一宫的 3、8 都只出现在 A、B。', 'A：{1,3,8}　B：{3,6,8}', '可删除 A 的 1 和 B 的 6。'] },
    action: 'eliminate'
  },
  {
    id: 'naked-triple', label: '显性三数组', tier: 2, summary: '三个格的候选，并起来恰好三个数。',
    principle: '同一区域内的三个空格，如果所有候选合起来恰好只有三个数字，这三个数就被这三格占据，可从区域其余格中删除。',
    steps: ['在同一区域内寻找三个空格。', '检查三个格的候选并集恰好为三个数。', '删除区域其他格中的这三个候选。'],
    mistakes: '每格不必包含完整的三个数。但任何一格出现第四个数，三数组就不成立。',
    example: { title: '不必是三个完全相同的格', lines: ['A：{1,4}　B：{4,9}　C：{1,9}', '三格合起来只有 1、4、9。', '同一区域其他格可删除 1、4、9。'] },
    action: 'eliminate'
  },
  {
    id: 'hidden-triple', label: '隐性三数组', tier: 2, summary: '三个数字的所有位置，合起来只有三格。',
    principle: '同一区域里，三个数字的所有候选位置如果合起来恰好只有三个空格，这三格必须容纳它们，可以删除三格中其余候选。',
    steps: ['选择同一区域中的三个数字。', '确认它们的候选位置合并后只有三格。', '从这三格中删除其他数字的候选。'],
    mistakes: '有的数字可以只占其中两格；关键是三个数字的全部位置都被限制在这三格。',
    example: { title: '从数字反过来找格子', lines: ['同一列的 2、5、7 只出现在 A、B、C。', 'A、B、C 可能还写着其他候选。', '这些额外候选都可以删除。'] },
    action: 'eliminate'
  },
  {
    id: 'x-wing', label: 'X-Wing', tier: 2, summary: '两行中的同一数字，被锁在相同两列。',
    principle: '某数字在两行中各只有两个候选位置，且对应同样的两列，它就会分别占据这两列。两列中其他行的该候选可以删除。行列可以互换。',
    steps: ['只观察一个数字的候选位置。', '找两行，各只有两处候选且两列相同。', '从这两列的其他行中删除该候选。'],
    mistakes: '作为依据的两行不能存在第三处候选。另两列可以有其他候选，它们正是要被排除的位置。',
    example: { title: '候选 4 的矩形', lines: ['第 2、7 行的 4 都只在第 3、8 列。', '4 将占据矩形的两条对角线之一。', '第 3、8 列其他行可删除候选 4。'] },
    action: 'eliminate'
  },
  {
    id: 'xy-wing', label: 'XY-Wing', tier: 3, summary: '三格双候选，连接出必然出现的一个数。',
    principle: '枢纽格为 {X,Y}，能分别看见翼格 {X,Z} 与 {Y,Z}。无论枢纽填 X 还是 Y，至少一翼是 Z，因此同时看见两翼的其他格可删除 Z。',
    steps: ['找一个双候选枢纽 {X,Y}。', '找它能看见的两翼 {X,Z}、{Y,Z}。', '删除同时看见两翼的其他格中的 Z。'],
    mistakes: '三格必须都恰好双候选。删除目标必须同时看见两翼，不能只看见枢纽或其中一翼。',
    example: { title: '一次分情况推理', lines: ['枢纽 {2,7}，两翼 {2,9}、{7,9}。', '枢纽无论是 2 还是 7，总有一翼为 9。', '两翼共同看见的格可删除候选 9。'] },
    action: 'eliminate'
  },
  {
    id: 'xyz-wing', label: 'XYZ-Wing', tier: 3, summary: '三候选枢纽与两个翼格，共同限制 Z。',
    principle: '枢纽格为 {X,Y,Z}，能分别看见 {X,Z} 与 {Y,Z} 两翼。三格中至少一格是 Z，因此同时看见这三格的其他格可删除 Z。',
    steps: ['找三候选枢纽 {X,Y,Z}。', '找它能看见的两翼 {X,Z}、{Y,Z}。', '删除同时看见三格的其他格中的 Z。'],
    mistakes: '与 XY-Wing 不同，目标必须也看见枢纽。只看见两翼的目标不能据此删除 Z。',
    example: { title: '枢纽也可能是 9', lines: ['枢纽 {2,7,9}，两翼 {2,9}、{7,9}。', '这三格中至少有一格填 9。', '三格共同看见的其他格可删除 9。'] },
    action: 'eliminate'
  },
  {
    id: 'swordfish', label: '剑鱼', tier: 3, summary: '三行中的同一数字，被锁在相同三列。',
    principle: '某数字在三个基准行中的全部候选，合起来只占据三个列。三行需要的三个该数字将占据这三列，可删除这些列在其他行的该候选。行列可以互换。',
    steps: ['只观察一个数字，寻找三个基准行。', '确认每行有二或三处候选，合起来仅三列。', '从这三列的其他行中删除该候选。'],
    mistakes: '不是任意九个点构成的图形。必须确认基准行中没有落在这三列之外的该数字候选。',
    example: { title: '不必是完整的九点矩形', lines: ['候选 6：A 行在列 2、5；B 行在列 5、8。', 'C 行在列 2、8，三行合起来只有三列。', '列 2、5、8 的其他行可删除候选 6。'] },
    action: 'eliminate'
  }
].map(lesson => Object.freeze({ ...lesson,
  fullLabel: lesson.id === 'pointing' ? '区块排除·指向（宫→行列）' : lesson.id === 'claiming' ? '区块排除·认领（行列→宫）' : lesson.label,
  prerequisites: Object.freeze(lesson.tier === 0 ? ['rules', 'candidates'] : lesson.tier === 1 ? ['naked-single', 'hidden-single'] : lesson.id === 'swordfish' ? ['x-wing'] : lesson.id === 'xyz-wing' ? ['xy-wing'] : ['naked-pair', 'hidden-pair']),
  steps: Object.freeze(lesson.steps), example: Object.freeze({ ...lesson.example, lines: Object.freeze(lesson.example.lines) }) })));

function getLesson(id) { return LESSONS.find(lesson => lesson.id === id) || null; }

module.exports = { LESSONS, getLesson };
