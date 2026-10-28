package com.pichincha.mbbk.document.jira;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JiraKeysTest {

    @Test
    void extractsBrowseAndSelectedIssue() {
        assertThat(JiraKeys.extract("https://pichinchaperu.atlassian.net/browse/NEG-1694"))
                .isEqualTo("NEG-1694");
        assertThat(JiraKeys.extract("https://pichinchaperu.atlassian.net/jira/software/c/projects/APP/boards/179?selectedIssue=APP-14382"))
                .isEqualTo("APP-14382");
        assertThat(JiraKeys.extract("sin clave")).isNull();
    }
}
