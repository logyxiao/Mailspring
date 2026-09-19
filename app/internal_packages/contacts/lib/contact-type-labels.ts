import { localized } from '../../../src/intl';

// Translate presentation only: vCard / Google field types keep their original values.
export function contactTypeLabel(value: string) {
  const labels = {
    home: localized('Home'),
    work: localized('Work'),
    other: localized('Other'),
    mobile: localized('Mobile'),
    main: localized('Main'),
    'home fax': localized('Home Fax'),
    'work fax': localized('Work Fax'),
    pager: localized('Pager'),
    profile: localized('Profile'),
    blog: localized('Blog'),
    'home page': localized('Home Page'),
    spouse: localized('Spouse'),
    child: localized('Child'),
    mother: localized('Mother'),
    father: localized('Father'),
    parent: localized('Parent'),
    brother: localized('Brother'),
    sister: localized('Sister'),
    friend: localized('Friend'),
    relative: localized('Relative'),
    manager: localized('Manager'),
    assistant: localized('Assistant'),
    reference: localized('Reference'),
    partner: localized('Partner'),
    'domestic partner': localized('Domestic Partner'),
  };
  return labels[value?.toLowerCase()] || value;
}
