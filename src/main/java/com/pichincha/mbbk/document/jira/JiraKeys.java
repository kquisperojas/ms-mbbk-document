package com.pichincha.mbbk.document.jira;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class JiraKeys {

    private static final Pattern SELECTED = Pattern.compile("[?&]selectedIssue=([A-Z][A-Z0-9_]+-\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BROWSE = Pattern.compile("/browse/([A-Z][A-Z0-9_]+-\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANY = Pattern.compile("\\b([A-Z][A-Z0-9_]+-\\d+)\\b", Pattern.CASE_INSENSITIVE);

    private JiraKeys() {
    }

    public static String extract(String link) {
        String text = link == null ? "" : link.trim();
        Matcher selected = SELECTED.matcher(text);
        if (selected.find()) {
            return selected.group(1).toUpperCase();
        }
        Matcher browse = BROWSE.matcher(text);
        if (browse.find()) {
            return browse.group(1).toUpperCase();
        }
        Matcher any = ANY.matcher(text);
        return any.find() ? any.group(1).toUpperCase() : null;
    }
}
