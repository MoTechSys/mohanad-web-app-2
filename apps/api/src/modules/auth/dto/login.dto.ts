import { type LoginInput, loginSchema } from '@grocery/shared';
import { ApiProperty } from '@nestjs/swagger';

export { loginSchema };
export type { LoginInput };

/**
 * Swagger-only DTO mirror — used for /docs.
 * Runtime validation goes through ZodValidationPipe(loginSchema).
 */
export class LoginDto implements LoginInput {
  @ApiProperty({ example: 'owner', minLength: 3, maxLength: 50 })
  username!: string;

  @ApiProperty({ example: 'Owner@12345', minLength: 8 })
  password!: string;

  @ApiProperty({ example: false, default: false, required: false })
  rememberMe!: boolean;
}
