import { ExecutionResponse, TestAssertion } from '../types';

export function evaluateAssertions(
  assertions: TestAssertion[] | undefined,
  response: ExecutionResponse
): { assertions: TestAssertion[]; allPassed: boolean } {
  if (!assertions || assertions.length === 0) {
    return { assertions: [], allPassed: true };
  }

  let allPassed = true;

  const evaluated = assertions.map((a) => {
    if (!a.enabled) return { ...a, passed: true, message: 'Disabled' };

    let passed = false;
    let message = '';

    switch (a.type) {
      case 'status_code': {
        const expectedStatus = parseInt(a.targetValue || '200', 10);
        passed = response.status === expectedStatus;
        message = passed
          ? `Status code is ${response.status}`
          : `Expected status ${expectedStatus}, received ${response.status}`;
        break;
      }
      case 'max_time': {
        const maxMs = parseInt(a.targetValue || '1000', 10);
        passed = response.duration <= maxMs;
        message = passed
          ? `Response time ${response.duration}ms <= ${maxMs}ms`
          : `Response time ${response.duration}ms exceeded limit ${maxMs}ms`;
        break;
      }
      case 'body_contains': {
        passed = response.body.includes(a.targetValue || '');
        message = passed
          ? `Body contains string "${a.targetValue}"`
          : `Body does not contain expected string "${a.targetValue}"`;
        break;
      }
      case 'json_property': {
        try {
          const json = JSON.parse(response.body);
          const key = (a.targetValue || '').trim();
          passed = key in json || (typeof json === 'object' && json[key] !== undefined);
          message = passed
            ? `JSON property "${key}" exists`
            : `JSON property "${key}" missing in response body`;
        } catch (e) {
          passed = false;
          message = 'Response body is not valid JSON';
        }
        break;
      }
      default:
        passed = true;
        message = 'OK';
    }

    if (!passed) allPassed = false;

    return {
      ...a,
      passed,
      message,
    };
  });

  return { assertions: evaluated, allPassed };
}
