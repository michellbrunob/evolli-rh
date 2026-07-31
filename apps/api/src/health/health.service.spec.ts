import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('retorna status ok, versão da config e timestamp ISO em UTC', () => {
    const configService = { get: () => '1.2.3' } as unknown as ConfigService;
    const service = new HealthService(configService);

    const result = service.check();

    expect(result.status).toBe('ok');
    expect(result.version).toBe('1.2.3');
    expect(result.timestamp).toBe(new Date(result.timestamp).toISOString());
  });
});
