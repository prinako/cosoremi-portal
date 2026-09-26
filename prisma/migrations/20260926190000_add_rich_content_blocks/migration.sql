-- Add optional structured content without rewriting or removing legacy text.
ALTER TABLE "Page" ADD COLUMN "contentBlocks" JSONB;
ALTER TABLE "Post" ADD COLUMN "contentBlocks" JSONB;
ALTER TABLE "WorkArea" ADD COLUMN "contentBlocks" JSONB;
