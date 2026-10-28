package com.pichincha.mbbk.document.jira;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JiraJqlTest {

    private final JiraProperties properties = new JiraProperties(
            "https://pichinchaperu.atlassian.net",
            "",
            "",
            "APP",
            "179",
            "Solucionado",
            "Epic",
            "");

    @Test
    void assignedUsesBoardFilterEpicSolvedAndAssignee() {
        String jql = JiraJql.build("assigned", "32100", properties);
        assertThat(jql).isEqualTo(
                "filter = 32100 AND issuetype in (\"Epic\") AND status in (\"Solucionado\") AND assignee IS NOT EMPTY ORDER BY updated DESC");
    }

    @Test
    void mineUsesCurrentUser() {
        String jql = JiraJql.build("mine", "32100", properties);
        assertThat(jql).contains("assignee = currentUser()");
        assertThat(jql).doesNotContain("project =");
    }

    @Test
    void placeholderWhenFilterUnknown() {
        String jql = JiraJql.build("assigned", "", properties);
        assertThat(jql).startsWith("filter = <tablero 179>");
    }

    @Test
    void customJqlWins() {
        JiraProperties custom = new JiraProperties(
                "https://pichinchaperu.atlassian.net", "", "", "APP", "179", "Solucionado", "Epic",
                "key = APP-1");
        assertThat(JiraJql.build("assigned", "1", custom)).isEqualTo("key = APP-1");
    }
}
