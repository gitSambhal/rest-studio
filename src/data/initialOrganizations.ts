import { Organization, EnvVariable } from '../types';
import { INITIAL_PROJECTS } from './initialProjects';

export const INITIAL_GLOBAL_VARIABLES: EnvVariable[] = [
  {
    id: 'gv_1',
    key: 'appName',
    value: 'RestStudio API Client',
    enabled: true,
    description: 'Global App Name',
  },
  {
    id: 'gv_2',
    key: 'globalTimeout',
    value: '5000',
    enabled: true,
    description: 'Global Request Timeout (ms)',
  },
];

export const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_acme',
    name: 'Acme Enterprise Inc.',
    description: 'Core engineering and production services organization.',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 3600000,
    variables: [
      {
        id: 'ov_1',
        key: 'orgDomain',
        value: 'acme.internal.api',
        enabled: true,
        description: 'Organization Internal Domain',
      },
      {
        id: 'ov_2',
        key: 'orgRegion',
        value: 'us-east-1',
        enabled: true,
        description: 'Primary Cloud Region',
      },
      {
        id: 'ov_3',
        key: 'baseUrl',
        value: 'https://org-default.acme.io',
        enabled: true,
        description: 'Org Default Base URL (Can be overridden by Project)',
      },
    ],
    projects: [INITIAL_PROJECTS[0], INITIAL_PROJECTS[2]], // E-Commerce & HTTPBin
  },
  {
    id: 'org_labs',
    name: 'Open Source Labs',
    description: 'Public, open weather, and geo microservices test lab.',
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 2,
    variables: [
      {
        id: 'ov_10',
        key: 'orgDomain',
        value: 'labs.open-data.org',
        enabled: true,
        description: 'Labs Domain',
      },
      {
        id: 'ov_11',
        key: 'rateLimit',
        value: '1000',
        enabled: true,
        description: 'Requests per minute',
      },
    ],
    projects: [INITIAL_PROJECTS[1]], // Weather & Geo
  },
];
