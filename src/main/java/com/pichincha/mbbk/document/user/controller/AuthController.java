package com.pichincha.mbbk.document.user.controller;

import com.pichincha.mbbk.document.user.dto.LoginRequest;
import com.pichincha.mbbk.document.user.dto.PasswordResetRequest;
import com.pichincha.mbbk.document.user.dto.UserResponse;
import com.pichincha.mbbk.document.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "Inicio de sesión del portal MBBK")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión con usuario GitHub y contraseña")
    public UserResponse login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }

    @PostMapping("/password")
    @Operation(summary = "Actualizar contraseña con el usuario GitHub")
    public UserResponse resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        return userService.resetPassword(request);
    }
}
