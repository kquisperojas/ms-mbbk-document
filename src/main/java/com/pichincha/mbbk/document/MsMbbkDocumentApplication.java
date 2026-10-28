package com.pichincha.mbbk.document;

import com.pichincha.mbbk.document.jira.JiraProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(JiraProperties.class)
public class MsMbbkDocumentApplication {

    public static void main(String[] args) {
        SpringApplication.run(MsMbbkDocumentApplication.class, args);
    }
}
