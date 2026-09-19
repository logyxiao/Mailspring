import React from 'react';
import { localized, DateUtils } from 'mailspring-exports';
import { EventPropertyRow } from './event-property-row';
import moment from 'moment-timezone';

export interface TimeZoneSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

// Friendly display names for common timezones (like Apple Calendar)
const TIMEZONE_DISPLAY_NAMES: { [key: string]: string } = {
  'America/New_York': localized('Eastern Time'),
  'America/Chicago': localized('Central Time'),
  'America/Denver': localized('Mountain Time'),
  'America/Los_Angeles': localized('Pacific Time'),
  'America/Anchorage': localized('Alaska Time'),
  'Pacific/Honolulu': localized('Hawaii Time'),
  'America/Toronto': localized('Eastern Time (Toronto)'),
  'America/Vancouver': localized('Pacific Time (Vancouver)'),
  'America/Mexico_City': localized('Central Time (Mexico)'),
  'America/Sao_Paulo': localized('Brasilia Time'),
  'Europe/London': localized('Greenwich Mean Time'),
  'Europe/Paris': localized('Central European Time'),
  'Europe/Berlin': localized('Central European Time'),
  'Europe/Moscow': localized('Moscow Time'),
  'Asia/Dubai': localized('Gulf Standard Time'),
  'Asia/Kolkata': localized('India Standard Time'),
  'Asia/Singapore': localized('Singapore Time'),
  'Asia/Shanghai': localized('China Standard Time'),
  'Asia/Hong_Kong': localized('Hong Kong Time'),
  'Asia/Tokyo': localized('Japan Standard Time'),
  'Asia/Seoul': localized('Korea Standard Time'),
  'Australia/Sydney': localized('Australian Eastern Time'),
  'Australia/Perth': localized('Australian Western Time'),
  'Pacific/Auckland': localized('New Zealand Time'),
};

// Common time zones - a curated list of frequently used zones
const COMMON_TIMEZONES = Object.keys(TIMEZONE_DISPLAY_NAMES);

function formatTimezone(tz: string): string {
  // Use friendly name if available, otherwise format from timezone ID
  if (TIMEZONE_DISPLAY_NAMES[tz]) {
    return TIMEZONE_DISPLAY_NAMES[tz];
  }
  // Fallback: Convert "America/New_York" to "New York"
  const name = tz.split('/').pop().replace(/_/g, ' ');
  return name;
}

export const TimeZoneSelector: React.FC<TimeZoneSelectorProps> = ({ value, onChange }) => {
  // Ensure current value is in the list
  const timezones = COMMON_TIMEZONES.includes(value)
    ? COMMON_TIMEZONES
    : [value, ...COMMON_TIMEZONES];

  return (
    <EventPropertyRow label={localized('time zone:')}>
      <select className="timezone-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {formatTimezone(tz)}
          </option>
        ))}
      </select>
    </EventPropertyRow>
  );
};
