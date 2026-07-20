import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  MaxFileSizeValidator,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { Public, CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { UploadImageDto, CreateVideoDto } from './dto/media.dto';

/** Hard ceiling on the raw upload before sharp compresses it. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Boat + cabin media galleries. Images are uploaded straight to Cloudflare R2
 * via a presigned URL then confirmed here; videos are YouTube links. Read is
 * public (guest-facing galleries); writes need assets:edit on the boat.
 */
@Controller('houseboats/:houseboatId/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get()
  list(
    @Param('houseboatId') houseboatId: string,
    @Query('cabinId') cabinId?: string,
  ) {
    return this.media.list(houseboatId, cabinId);
  }

  @Post('images')
  @RequirePermission({ module: 'assets', action: 'edit' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  uploadImage(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadImageDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: { buffer: Buffer; mimetype: string },
  ) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }
    return this.media.uploadImage(houseboatId, user.id, {
      cabinId: dto.cabinId,
      buffer: file.buffer,
      sortOrder: dto.sortOrder,
    });
  }

  @Post('videos')
  @RequirePermission({ module: 'assets', action: 'edit' })
  createVideo(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVideoDto,
  ) {
    return this.media.createVideo(houseboatId, user.id, dto);
  }

  @Delete(':mediaId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  remove(
    @Param('houseboatId') houseboatId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.remove(houseboatId, user.id, mediaId);
  }
}
