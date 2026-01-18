import { Language } from './common'

export const workflow: Record<Language, Record<string, string>> = {
  zh: {
    // Workflow 工作流
    'workflow.editor.addNode': '添加节点',
    'workflow.editor.help': '操作说明',
    'workflow.nodes.start': '开始',
    'workflow.nodes.end': '结束',
    'workflow.nodes.task': '任务',
    'workflow.nodes.gateway': '条件判断',
    'workflow.nodes.event': '事件',
    'workflow.nodes.subflow': '子流程',
    'workflow.nodes.parallel': '并行',
    'workflow.nodes.wait': '等待',
    'workflow.nodes.timer': '定时器',
    'workflow.nodes.script': '脚本',
  },
  en: {
    // Workflow
    'workflow.editor.addNode': 'Add Node',
    'workflow.editor.help': 'Help',
    'workflow.nodes.start': 'Start',
    'workflow.nodes.end': 'End',
    'workflow.nodes.task': 'Task',
    'workflow.nodes.gateway': 'Gateway',
    'workflow.nodes.event': 'Event',
    'workflow.nodes.subflow': 'Subflow',
    'workflow.nodes.parallel': 'Parallel',
    'workflow.nodes.wait': 'Wait',
    'workflow.nodes.timer': 'Timer',
    'workflow.nodes.script': 'Script',
  },
  ja: {
    // ワークフロー
    'workflow.editor.addNode': 'ノードを追加',
    'workflow.editor.help': 'ヘルプ',
    'workflow.nodes.start': '開始',
    'workflow.nodes.end': '終了',
    'workflow.nodes.task': 'タスク',
    'workflow.nodes.gateway': 'ゲートウェイ',
    'workflow.nodes.event': 'イベント',
    'workflow.nodes.subflow': 'サブフロー',
    'workflow.nodes.parallel': '並列',
    'workflow.nodes.wait': '待機',
    'workflow.nodes.timer': 'タイマー',
    'workflow.nodes.script': 'スクリプト',
  }
}