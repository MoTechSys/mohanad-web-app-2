-- CreateTable
CREATE TABLE "daily_incomes" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'نقدي',
    "details_text" TEXT,
    "income_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,

    CONSTRAINT "daily_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_incomes_store_id_idx" ON "daily_incomes"("store_id");

-- CreateIndex
CREATE INDEX "daily_incomes_income_date_idx" ON "daily_incomes"("income_date");

-- CreateIndex
CREATE INDEX "daily_incomes_is_approved_idx" ON "daily_incomes"("is_approved");

-- CreateIndex
CREATE INDEX "daily_incomes_cancelled_at_idx" ON "daily_incomes"("cancelled_at");

-- AddForeignKey
ALTER TABLE "daily_incomes" ADD CONSTRAINT "daily_incomes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_incomes" ADD CONSTRAINT "daily_incomes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_incomes" ADD CONSTRAINT "daily_incomes_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
