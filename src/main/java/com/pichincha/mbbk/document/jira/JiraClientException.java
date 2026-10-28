package com.pichincha.mbbk.document.jira;

public class JiraClientException extends RuntimeException {

    private final int status;

    public JiraClientException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
