import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';

class Dto {
  @IsString() @MaxLength(5) name!: string;
}

/** disableErrorMessages is what stops prod 400s from enumerating the schema. */
describe('ValidationPipe disableErrorMessages', () => {
  const meta = { type: 'body' as const, metatype: Dto, data: '' };

  it('dev: includes the constraint detail', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, disableErrorMessages: false });
    await expect(pipe.transform({ name: 'toolong' }, meta)).rejects.toThrow(BadRequestException);
    try { await pipe.transform({ name: 'toolong' }, meta); } catch (e: any) {
      expect(JSON.stringify(e.getResponse())).toContain('name');
    }
  });

  it('prod: suppresses the constraint detail', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, disableErrorMessages: true });
    try { await pipe.transform({ name: 'toolong' }, meta); throw new Error('should have thrown'); } catch (e: any) {
      const body = JSON.stringify(e.getResponse());
      expect(body).not.toContain('name');
      expect(body).not.toContain('MaxLength');
    }
  });
});
