import { Project } from '../types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_ecommerce',
    name: 'E-Commerce & Auth Workspace',
    description: 'REST Client workspace for User Auth, Products, and Orders microservices.',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 3600000 * 2,
    activeEnvId: 'env_dev',
    environments: [
      {
        id: 'env_dev',
        name: 'Development (Local/Dummy)',
        color: '#10b981', // Emerald
        variables: [
          { id: 'v1', key: 'baseUrl', value: 'https://dummyjson.com', enabled: true, description: 'Dev API Base URL' },
          { id: 'v2', key: 'authToken', value: 'dev_bearer_token_abc123', enabled: true, description: 'JWT Auth token', secret: true },
          { id: 'v3', key: 'userId', value: '1', enabled: true, description: 'Active User ID' },
          { id: 'v4', key: 'category', value: 'laptops', enabled: true, description: 'Product category' },
          { id: 'v5', key: 'limit', value: '10', enabled: true, description: 'Pagination limit' },
        ],
      },
      {
        id: 'env_stg',
        name: 'Staging Server',
        color: '#f59e0b', // Amber
        variables: [
          { id: 'v10', key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true, description: 'Staging API Base URL' },
          { id: 'v11', key: 'authToken', value: 'stg_bearer_token_xyz987', enabled: true, description: 'Staging JWT token', secret: true },
          { id: 'v12', key: 'userId', value: '2', enabled: true, description: 'Staging User ID' },
          { id: 'v13', key: 'category', value: 'smartphones', enabled: true, description: 'Product category' },
          { id: 'v14', key: 'limit', value: '5', enabled: true, description: 'Pagination limit' },
        ],
      },
      {
        id: 'env_prod',
        name: 'Production Cloud',
        color: '#ef4444', // Red
        variables: [
          { id: 'v20', key: 'baseUrl', value: 'https://reqres.in/api', enabled: true, description: 'Prod Base URL' },
          { id: 'v21', key: 'authToken', value: 'live_prod_secret_token_999', enabled: true, description: 'Prod Token', secret: true },
          { id: 'v22', key: 'userId', value: '3', enabled: true, description: 'Prod User ID' },
          { id: 'v23', key: 'category', value: 'shoes', enabled: true, description: 'Category' },
          { id: 'v24', key: 'limit', value: '20', enabled: true, description: 'Pagination' },
        ],
      },
    ],
    folders: [
      { id: 'folder_auth', name: 'Authentication', fileIds: ['file_auth'] },
      { id: 'folder_catalog', name: 'Catalog & Store', fileIds: ['file_products'] },
    ],
    files: [
      {
        id: 'file_auth',
        name: 'auth.rest',
        updatedAt: Date.now() - 3600000,
        rawContent: `@authService = {{baseUrl}}/auth

### User Login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "username": "kminchelle",
  "password": "0x6041"
}

### Get User Profile
GET {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{authToken}}
Accept: application/json
`,
        requests: [
          {
            id: 'req_login',
            name: 'User Login',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            headers: [
              { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
            ],
            queryParams: [],
            body: {
              mode: 'json',
              rawText: '{\n  "username": "kminchelle",\n  "password": "0x6041"\n}',
            },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'req_profile',
            name: 'Get User Profile',
            method: 'GET',
            url: '{{baseUrl}}/users/{{userId}}',
            headers: [
              { id: 'h2', key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true },
              { id: 'h3', key: 'Accept', value: 'application/json', enabled: true },
            ],
            queryParams: [],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'bearer', bearerToken: '{{authToken}}' },
          },
        ],
      },
      {
        id: 'file_products',
        name: 'products.rest',
        updatedAt: Date.now() - 7200000,
        rawContent: `### Get All Products
GET {{baseUrl}}/products?limit={{limit}}
Accept: application/json

### Search Products by Category
GET {{baseUrl}}/products/category/{{category}}
Accept: application/json

### Add New Product
POST {{baseUrl}}/products/add
Content-Type: application/json

{
  "title": "Wireless Ergonomic Mouse",
  "price": 49.99,
  "category": "{{category}}"
}
`,
        requests: [
          {
            id: 'req_get_products',
            name: 'Get All Products',
            method: 'GET',
            url: '{{baseUrl}}/products',
            headers: [{ id: 'ph1', key: 'Accept', value: 'application/json', enabled: true }],
            queryParams: [{ id: 'qp1', key: 'limit', value: '{{limit}}', enabled: true }],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'req_category_products',
            name: 'Search Products by Category',
            method: 'GET',
            url: '{{baseUrl}}/products/category/{{category}}',
            headers: [{ id: 'ph2', key: 'Accept', value: 'application/json', enabled: true }],
            queryParams: [],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'req_add_product',
            name: 'Add New Product',
            method: 'POST',
            url: '{{baseUrl}}/products/add',
            headers: [{ id: 'ph3', key: 'Content-Type', value: 'application/json', enabled: true }],
            queryParams: [],
            body: {
              mode: 'json',
              rawText: '{\n  "title": "Wireless Ergonomic Mouse",\n  "price": 49.99,\n  "category": "{{category}}"\n}',
            },
            auth: { type: 'none', bearerToken: '' },
          },
        ],
      },
    ],
  },
  {
    id: 'proj_weather',
    name: 'Weather & Geo APIs',
    description: 'REST file project for location, geocoding, and open weather endpoints.',
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000,
    activeEnvId: 'env_weather_default',
    environments: [
      {
        id: 'env_weather_default',
        name: 'Default Environment',
        color: '#3b82f6', // Blue
        variables: [
          { id: 'wv1', key: 'apiHost', value: 'https://api.open-meteo.com/v1', enabled: true, description: 'Open-Meteo Base URL' },
          { id: 'wv2', key: 'lat', value: '52.52', enabled: true, description: 'Latitude (Berlin)' },
          { id: 'wv3', key: 'lon', value: '13.41', enabled: true, description: 'Longitude (Berlin)' },
          { id: 'wv4', key: 'city', value: 'Berlin', enabled: true, description: 'City name' },
        ],
      },
    ],
    folders: [],
    files: [
      {
        id: 'file_weather_rest',
        name: 'forecast.rest',
        updatedAt: Date.now() - 86400000,
        rawContent: `### Get Current Weather Forecast
GET {{apiHost}}/forecast?latitude={{lat}}&longitude={{lon}}&current_weather=true

### Get Weather Hourly Temperature
GET {{apiHost}}/forecast?latitude={{lat}}&longitude={{lon}}&hourly=temperature_2m
`,
        requests: [
          {
            id: 'wreq_current',
            name: 'Get Current Weather Forecast',
            method: 'GET',
            url: '{{apiHost}}/forecast',
            headers: [],
            queryParams: [
              { id: 'wq1', key: 'latitude', value: '{{lat}}', enabled: true },
              { id: 'wq2', key: 'longitude', value: '{{lon}}', enabled: true },
              { id: 'wq3', key: 'current_weather', value: 'true', enabled: true },
            ],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'wreq_hourly',
            name: 'Get Weather Hourly Temperature',
            method: 'GET',
            url: '{{apiHost}}/forecast',
            headers: [],
            queryParams: [
              { id: 'wq4', key: 'latitude', value: '{{lat}}', enabled: true },
              { id: 'wq5', key: 'longitude', value: '{{lon}}', enabled: true },
              { id: 'wq6', key: 'hourly', value: 'temperature_2m', enabled: true },
            ],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
        ],
      },
    ],
  },
  {
    id: 'proj_httpbin',
    name: 'HTTP Testing & Diagnostics',
    description: 'REST Client file suite for inspecting headers, status codes, and echoes.',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 1800000,
    activeEnvId: 'env_httpbin',
    environments: [
      {
        id: 'env_httpbin',
        name: 'Httpbin Sandbox',
        color: '#8b5cf6', // Purple
        variables: [
          { id: 'hv1', key: 'baseUrl', value: 'https://httpbin.org', enabled: true, description: 'Httpbin base host' },
          { id: 'hv2', key: 'secretApiKey', value: 'secret_diagnostic_key_77', enabled: true, description: 'Test API Key', secret: true },
        ],
      },
    ],
    folders: [],
    files: [
      {
        id: 'file_httpbin_rest',
        name: 'httpbin.rest',
        updatedAt: Date.now() - 1800000,
        rawContent: `### Echo Headers
GET {{baseUrl}}/headers
X-Custom-Header: TestHeaderValue
X-Api-Key: {{secretApiKey}}

### Post JSON Payload
POST {{baseUrl}}/post
Content-Type: application/json

{
  "client": "RestStudio REST Client",
  "env": "Httpbin Sandbox",
  "status": "active"
}

### Test Status 200 OK
GET {{baseUrl}}/status/200

### Test Delay (1s)
GET {{baseUrl}}/delay/1
`,
        requests: [
          {
            id: 'hreq_headers',
            name: 'Echo Headers',
            method: 'GET',
            url: '{{baseUrl}}/headers',
            headers: [
              { id: 'hh1', key: 'X-Custom-Header', value: 'TestHeaderValue', enabled: true },
              { id: 'hh2', key: 'X-Api-Key', value: '{{secretApiKey}}', enabled: true },
            ],
            queryParams: [],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'hreq_post',
            name: 'Post JSON Payload',
            method: 'POST',
            url: '{{baseUrl}}/post',
            headers: [{ id: 'hh3', key: 'Content-Type', value: 'application/json', enabled: true }],
            queryParams: [],
            body: {
              mode: 'json',
              rawText: '{\n  "client": "RestStudio REST Client",\n  "env": "Httpbin Sandbox",\n  "status": "active"\n}',
            },
            auth: { type: 'none', bearerToken: '' },
          },
          {
            id: 'hreq_status',
            name: 'Test Status 200 OK',
            method: 'GET',
            url: '{{baseUrl}}/status/200',
            headers: [],
            queryParams: [],
            body: { mode: 'none', rawText: '' },
            auth: { type: 'none', bearerToken: '' },
          },
        ],
      },
    ],
  },
];
