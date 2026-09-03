# 08 - التقارير

> ملاحظة عامة: لكل تقرير **3 صلاحيات** منفصلة: `view`, `print`, `export`.

## 1. تقارير يومية

| التقرير | view | print | export |
|---|---|---|---|
| دخل اليوم | reports.daily_summary.view | reports.print.daily_summary | reports.export.daily_summary |
| خرج اليوم | reports.expenses.view | reports.print.expenses | reports.export.expenses |
| المبيعات اليومية | reports.sales.view | reports.print.daily_summary | reports.export.daily_summary |
| السداد من العملاء | reports.daily_summary.view | reports.print.daily_summary | reports.export.daily_summary |
| الديون الجديدة | reports.customer_debts.view | reports.print.customer_debts | reports.export.customer_debts |
| المدفوع للتجار | reports.supplier_debts.view | reports.print.supplier_debts | reports.export.supplier_debts |
| حركات العمال اليوم | reports.user_activity.view | reports.print.user_activity | reports.export.user_activity |

## 2. تقارير العملاء

```text
- إجمالي ديون العملاء
- أعلى العملاء ديناً (Top N)
- عملاء تجاوزوا سقف الدين
- عملاء في مهلة
- عملاء مجمدون
- كشف حساب عميل (timeline)
- حركات عميل حسب اليوم/الأسبوع/الشهر
- تذكيرات العملاء
```

صلاحيات: `reports.customer_debts.*` و `reports.customer_statement.*`.

## 3. تقارير التجار

```text
- إجمالي ديون التجار
- أعلى التجار ديناً
- كشف حساب تاجر
- مشتريات حسب تاجر
- مدفوعات حسب تاجر
- ديون آجلة للتجار
```

صلاحيات: `reports.supplier_debts.*` و `reports.supplier_statement.*`.

## 4. تقارير المشتريات

```text
- مشتريات اليوم / الشهر
- مشتريات نقدية
- مشتريات آجلة
- مشتريات حسب تاجر
- مشتريات تفصيلية حسب صنف (إذا مفعّل)
```

صلاحيات: `reports.purchases.*`.

## 5. تقارير المصاريف

```text
- الخرج العادي اليومي / الشهري
- المصاريف حسب التصنيف
- مصروفات العمال (رواتب)
- مستلزمات
- أخرى
```

> ملاحظة: `supplier_payment` لا يُحسب كمصروف تشغيلي في تقرير الربح والخسارة.

صلاحيات: `reports.expenses.*`.

## 6. تقارير الربح والخسارة

```text
- ربح/خسارة يومي
- ربح/خسارة أسبوعي
- ربح/خسارة شهري
- مقارنة شهرية
- ربح تقديري أو دقيق حسب الإعداد
```

### صيغة الحساب الدقيقة (`accurate_by_sales_items`):
```text
صافي الربح = إجمالي المبيعات
            - تكلفة البضاعة المباعة (sum of sale_items.total_cost)
            - المصاريف التشغيلية (expenses where type IN ('normal', 'cash_purchase' حسب الإعداد))
```

> `supplier_payment` لا يدخل.
> `cash_purchase` قد يدخل أو يعامَل كزيادة مخزون حسب الإعداد.

### صيغة تقديرية (`estimated_by_daily_income`):
```text
صافي الربح التقديري = الدخل اليومي
                    - المصاريف التشغيلية
                    - تكلفة بضاعة تقديرية (لو متوفرة) أو مهملة
```

> يجب أن يظهر في التقرير: **"تقديري"** بوضوح + سبب التقدير.

### صيغة يدوية (`manual_cogs`):
```text
صافي الربح = الدخل اليومي - manual_cogs_amount - المصاريف التشغيلية
```

صلاحيات: `reports.profit_loss.*`.

## 7. تقارير التدفق النقدي

```text
+ النقد الداخل:
    - مبيعات نقدية
    - سداد عملاء
+ النقد الخارج:
    - دفع للتجار
    - مصاريف عادية (نقدي)
    - مشتريات نقدية
= صافي النقد
```

صلاحيات: `reports.cash_flow.*`.

## 8. تقارير المخزون

إذا `inventory_enabled = true`:
```text
- قائمة المنتجات + الكميات
- المنتجات المنخفضة (current_quantity <= min_quantity)
- حركات المخزون (in/out/adjust)
- دخول مخزون (مصدره: شراء أو إدخال يدوي)
- خروج مخزون (مصدره: بيع أو إخراج يدوي)
- تعديلات المخزون
```

إذا `inventory_enabled = false`:
```text
- قائمة المنتجات فقط (بدون كميات حقيقية)
```

صلاحيات: `reports.inventory.*`.

## 9. تقارير العمال والصلاحيات

```text
- حركات كل عامل (CRUD)
- عدد العمليات لكل عامل
- الديون التي أضافها عامل
- السداد الذي سجله عامل
- العمليات الملغاة
- محاولات الوصول المرفوضة
- آخر دخول
```

صلاحيات: `reports.user_activity.*`.

## 10. تقارير سجل الحركات (Audit)

```text
- كل عمليات الإنشاء
- كل عمليات التعديل
- كل عمليات الإلغاء
- كل عمليات الحذف الناعم
- من غيّر ماذا ومتى (entity + diff)
- محاولات الوصول المرفوضة
```

صلاحيات: `reports.audit.view` + `audit_logs.*`.

## 11. تقرير تحليل سلوك العملاء

```text
- متوسط شراء العميل خلال آخر N يوم.
- شراء اليوم/الفترة الأخيرة.
- نسبة الانخفاض.
- العملاء الذين انخفض شراؤهم بنسبة > threshold.
```

الإعدادات:
```text
enable_behavior_analysis : bool
behavior_analysis_days : int (default 30)
minimum_transactions_for_analysis : int (default 5)
behavior_drop_threshold_percentage : decimal (default 50)
```

صلاحيات: `reports.behavior_analysis.view`.

## 12. الطباعة

- تنفّذ في الفرونت عبر `window.print()` مع CSS Print خاص.
- أو في الباكند توليد PDF (لاحقاً).
- زر الطباعة يظهر فقط لمن يملك `reports.print.<name>`.

## 13. التصدير

- صيغ مدعومة: **xlsx**, **csv**, **pdf**.
- في الباكند: مكتبة `exceljs` للـ xlsx، `papaparse` للـ csv، `pdfmake` للـ pdf.
- الزر يظهر فقط لمن يملك `reports.export.<name>`.

## 14. وسوم تقرير دقيق/تقديري

كل تقرير يجب أن يعرض:
```text
{
  "report_type": "profit_loss",
  "accuracy": "accurate" | "estimated" | "manual",
  "accuracy_reason": "تم استخدام البيع التفصيلي مع الأصناف"
                    | "لا يوجد بيع تفصيلي، استخدم الدخل اليومي"
                    | "تم إدخال COGS يدوياً",
  "period": { "from": "...", "to": "..." },
  "data": { ... },
  "generated_at": "...",
  "generated_by": { "id": "...", "name": "..." }
}
```

## 15. حفظ Snapshots

كل تقرير مولّد يمكن حفظه في `report_snapshots` بقيمة JSON كاملة، يكون مرجعاً للتقارير الشهرية المُغلقة.

## 16. ملاحظات أخيرة

- **سداد العميل ليس ربحاً جديداً** إذا كان الدين مسجلاً سابقاً كبيع.
- **دفع التاجر ليس خسارة جديدة**، بل سداد التزام سابق.
- يجب التمييز بين **التدفق النقدي** و **الربح والخسارة**.
- إذا الدخل اليومي إجمالي فقط، الربح **لا يمكن** حسابه بدقة.
