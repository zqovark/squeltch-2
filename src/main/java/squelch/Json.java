package squelch;

/** Only writes JSON strings; request bodies use standard URL-encoded forms. */
final class Json {
    static String quote(String value) {
        var out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c=='"' || c=='\\') out.append('\\').append(c);
            else if (c<32) out.append(String.format("\\u%04x", (int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private Json() {}
}
