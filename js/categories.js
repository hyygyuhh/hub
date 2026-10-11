/** Shared category taxonomy for ShelfHub (front + docs). */
const SHELFHUB_CATEGORIES = {
  ai: { name: 'AI 工具', short: 'AI' },
  development: { name: '开发工具', short: '开发' },
  office: { name: '办公效率', short: '办公' },
  design: { name: '设计创意', short: '创作' },
  entertainment: { name: '影音娱乐', short: '影音' },
  system: { name: '系统工具', short: '系统' },
  network: { name: '网络通讯', short: '网络' },
  security: { name: '安全防护', short: '安全' },
  tools: { name: '实用工具', short: '工具' },
  games: { name: '游戏娱乐', short: '游戏' }
};

if (typeof window !== 'undefined') {
  window.SHELFHUB_CATEGORIES = SHELFHUB_CATEGORIES;
}
