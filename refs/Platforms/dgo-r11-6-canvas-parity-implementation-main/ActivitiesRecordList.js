import { ActivitiesRecordCard } from './ActivitiesRecordCard.js';

export function ActivitiesRecordList(records, selectedId) {
  return {
    count: records.length,
    cards: records.map((record) => ActivitiesRecordCard(record, selectedId))
  };
}
