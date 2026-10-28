package com.pichincha.mbbk.document.docs;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ShellCssController {

    private final DocumentationEngine engine;

    public ShellCssController(DocumentationEngine engine) {
        this.engine = engine;
    }

    @GetMapping(value = {"/doc/shell.css", "/api/v1/shell.css", "/api/shell.css"}, produces = "text/css;charset=UTF-8")
    public String shellCss() {
        return engine.run("shell", Map.of()).path("css").asText("");
    }
}
