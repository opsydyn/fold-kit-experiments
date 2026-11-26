export const reportChart = {
  title: 'Reports by month',
  description: 'January through March.',
  categoryHeading: 'Month',
  valueHeading: 'Reports',
  unit: 'reports',
  rows: [
    { key: 'jan', label: 'January', value: 12 },
    { key: 'feb', label: 'February', value: 24 },
    { key: 'mar', label: 'March', value: 36 },
  ],
};

export const deploymentChart = {
  title: 'Net deployments by region',
  description: 'Europe and North America.',
  categoryHeading: 'Region',
  valueHeading: 'Net deployments',
  unit: 'deployments',
  interactive: true,
  rows: [
    { key: 'eu', label: 'Europe', value: -4 },
    { key: 'na', label: 'North America', value: 8 },
  ],
};
