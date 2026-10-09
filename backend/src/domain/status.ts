export const TOPIC_STATUSES = ['not_started', 'studying', 'completed'] as const
export type TopicStatus = (typeof TOPIC_STATUSES)[number]

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
