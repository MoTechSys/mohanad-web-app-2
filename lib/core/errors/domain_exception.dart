/// A business-rule violation. `code` is stable (for tests / logic);
/// `message` is Arabic and safe to show to the user.
class DomainException implements Exception {
  const DomainException(this.code, this.message, {this.meta});

  final String code;
  final String message;
  final Map<String, Object?>? meta;

  @override
  String toString() => 'DomainException($code): $message';
}

class ErrorCodes {
  ErrorCodes._();
  static const invalidAmount = 'INVALID_AMOUNT';
  static const invalidQuantity = 'INVALID_QUANTITY';
  static const notFound = 'NOT_FOUND';
  static const alreadyCancelled = 'ALREADY_CANCELLED';
  static const openingProtected = 'OPENING_PROTECTED';
  static const customerFrozen = 'CUSTOMER_FROZEN';
  static const creditLimitExceeded = 'CREDIT_LIMIT_EXCEEDED';
  static const customerRequired = 'CUSTOMER_REQUIRED';
  static const supplierRequired = 'SUPPLIER_REQUIRED';
  static const itemsRequired = 'ITEMS_REQUIRED';
  static const negativeNet = 'NEGATIVE_NET';
  static const duplicate = 'DUPLICATE';
  static const hasBalance = 'HAS_BALANCE';
  static const insufficientStock = 'INSUFFICIENT_STOCK';
  static const invalidDate = 'INVALID_DATE';
  static const belowCost = 'BELOW_COST';
  static const sessionOpen = 'SESSION_OPEN';
  static const sessionClosed = 'SESSION_CLOSED';
}
