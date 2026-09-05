import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../data/ledger_db.dart';

/// Shows a PIN pad on launch when a PIN is configured.
class PinGate extends StatefulWidget {
  const PinGate({super.key, required this.child});
  final Widget child;

  @override
  State<PinGate> createState() => _PinGateState();
}

class _PinGateState extends State<PinGate> {
  bool _unlocked = false;

  @override
  Widget build(BuildContext context) {
    final pin = context.read<LedgerDb>().settings.pinCode;
    if (_unlocked || pin == null || pin.isEmpty) return widget.child;
    return PinPad(
      title: 'أدخل رمز الدخول',
      expected: pin,
      onSuccess: () => setState(() => _unlocked = true),
    );
  }
}

class PinPad extends StatefulWidget {
  const PinPad({
    super.key,
    required this.title,
    required this.expected,
    required this.onSuccess,
  });
  final String title;
  final String expected;
  final VoidCallback onSuccess;

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _entered = '';
  bool _error = false;

  void _tap(String d) {
    if (_entered.length >= 6) return;
    setState(() {
      _entered += d;
      _error = false;
    });
    if (_entered.length == widget.expected.length) {
      if (_entered == widget.expected) {
        widget.onSuccess();
      } else {
        setState(() {
          _error = true;
          _entered = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 56, color: context.c.primaryDark),
              const SizedBox(height: 12),
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  widget.expected.length,
                  (i) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _entered.length
                          ? context.c.primaryDark
                          : Colors.transparent,
                      border: Border.all(
                        color: _error
                            ? context.c.danger
                            : context.c.primaryDark,
                        width: 2,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 20,
                child: _error
                    ? Text(
                        'رمز غير صحيح',
                        style: TextStyle(color: context.c.danger),
                      )
                    : null,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: 260,
                child: GridView.count(
                  shrinkWrap: true,
                  crossAxisCount: 3,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    for (var i = 1; i <= 9; i++) _key('$i'),
                    const SizedBox.shrink(),
                    _key('0'),
                    _KeyButton(
                      child: const Icon(Icons.backspace_outlined),
                      onTap: () => setState(() {
                        if (_entered.isNotEmpty) {
                          _entered = _entered.substring(0, _entered.length - 1);
                        }
                      }),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _key(String d) => _KeyButton(
    onTap: () => _tap(d),
    child: Text(
      d,
      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
    ),
  );
}

class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.c.card,
      shape: CircleBorder(side: BorderSide(color: context.c.border)),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Center(child: child),
      ),
    );
  }
}
