import { type ChangePasswordInput, changePasswordSchema } from '@grocery/shared';
import { ApiProperty } from '@nestjs/swagger';

export { changePasswordSchema };
export type { ChangePasswordInput };

export class ChangePasswordDto {
  @ApiProperty({ example: 'Owner@12345' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword@2026', minLength: 8 })
  newPassword!: string;

  @ApiProperty({ example: 'NewPassword@2026', minLength: 8 })
  confirmPassword!: string;
}
