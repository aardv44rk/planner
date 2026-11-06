import React from 'react';
import { ScheduleWidget } from '../widgets/ScheduleWidget';

export const ScheduleView: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ScheduleWidget fullScreen={true} showPinButton={true} />
    </div>
  );
};
