package com.pichincha.mbbk.document.common;

import com.pichincha.mbbk.document.catalog.exception.InvalidCatalogException;
import com.pichincha.mbbk.document.credential.exception.CredentialNotFoundException;
import com.pichincha.mbbk.document.docs.DocumentationException;
import com.pichincha.mbbk.document.jira.JiraClientException;
import com.pichincha.mbbk.document.jira.JiraNotConfiguredException;
import com.pichincha.mbbk.document.user.exception.DuplicateUserException;
import com.pichincha.mbbk.document.user.exception.InvalidCredentialsException;
import com.pichincha.mbbk.document.user.exception.UserNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail handleNotFound(UserNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(CredentialNotFoundException.class)
    public ProblemDetail handleCredentialNotFound(CredentialNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(DuplicateUserException.class)
    public ProblemDetail handleDuplicate(DuplicateUserException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(InvalidCatalogException.class)
    public ProblemDetail handleInvalidCatalog(InvalidCatalogException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(JiraNotConfiguredException.class)
    public ProblemDetail handleJiraNotConfigured(JiraNotConfiguredException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
        problem.setProperty("error", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(DocumentationException.class)
    public ProblemDetail handleDocumentation(DocumentationException ex) {
        HttpStatus status = HttpStatus.resolve(ex.status());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status, ex.getMessage());
        problem.setProperty("error", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(JiraClientException.class)
    public ProblemDetail handleJiraClient(JiraClientException ex) {
        HttpStatus status = HttpStatus.resolve(ex.status());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                status == null ? HttpStatus.BAD_GATEWAY : status, ex.getMessage());
        problem.setProperty("error", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleIntegrity(DataIntegrityViolationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "El usuario GitHub o el correo ya están registrados");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Datos de usuario inválidos");
        problem.setProperty("errors", errors);
        return problem;
    }
}
