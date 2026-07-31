import { BadRequestException } from '@nestjs/common';
import { validatePlatformPermissionMap } from './platform-permission.types';

describe('validatePlatformPermissionMap', () => {
  it('accepts a valid map', () => {
    const map = { finance: { view: true, edit: false }, ops: { view: true } };
    expect(validatePlatformPermissionMap(map)).toEqual(map);
  });

  it('accepts an empty object (deny-all role)', () => {
    expect(validatePlatformPermissionMap({})).toEqual({});
  });

  it('rejects non-objects', () => {
    for (const bad of [null, 'x', 42, ['finance']]) {
      expect(() => validatePlatformPermissionMap(bad)).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects unknown modules loudly (typo must fail at write time)', () => {
    expect(() =>
      validatePlatformPermissionMap({ finanse: { view: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown actions', () => {
    expect(() =>
      validatePlatformPermissionMap({ finance: { admin: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects non-boolean values', () => {
    expect(() =>
      validatePlatformPermissionMap({ finance: { view: 'yes' } }),
    ).toThrow(BadRequestException);
  });
});
