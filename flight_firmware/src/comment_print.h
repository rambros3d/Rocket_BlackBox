#pragma once

#include <Arduino.h>

// Prefixes every line with "# " so dashboard parsers can separate log text from JSON frames.
class CommentPrint : public Print {
public:
    explicit CommentPrint(Print& out) : _out(out) {}
    size_t write(uint8_t c) override {
        if (_lineStart) {
            _out.print("# ");
            _lineStart = false;
        }
        if (c == '\n') _lineStart = true;
        return _out.write(c);
    }

private:
    Print& _out;
    bool _lineStart = true;
};
