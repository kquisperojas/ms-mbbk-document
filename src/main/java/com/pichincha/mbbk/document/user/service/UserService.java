package com.pichincha.mbbk.document.user.service;

import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.catalog.entity.Squad;
import com.pichincha.mbbk.document.catalog.exception.InvalidCatalogException;
import com.pichincha.mbbk.document.catalog.repository.RoleRepository;
import com.pichincha.mbbk.document.catalog.repository.SquadRepository;
import com.pichincha.mbbk.document.user.dto.LoginRequest;
import com.pichincha.mbbk.document.user.dto.PasswordResetRequest;
import com.pichincha.mbbk.document.user.dto.ProfileUpdateRequest;
import com.pichincha.mbbk.document.user.dto.UserCreateRequest;
import com.pichincha.mbbk.document.user.dto.UserResponse;
import com.pichincha.mbbk.document.user.dto.UserUpdateRequest;
import com.pichincha.mbbk.document.user.entity.User;
import com.pichincha.mbbk.document.user.exception.DuplicateUserException;
import com.pichincha.mbbk.document.user.exception.InvalidCredentialsException;
import com.pichincha.mbbk.document.user.exception.UserNotFoundException;
import com.pichincha.mbbk.document.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final SquadRepository squadRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       SquadRepository squadRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.squadRepository = squadRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse create(UserCreateRequest request) {
        if (userRepository.existsByGithubUsernameIgnoreCase(request.githubUsername())) {
            throw new DuplicateUserException("El usuario GitHub ya está registrado");
        }
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new DuplicateUserException("El correo ya está registrado");
        }
        User user = new User();
        applyProfile(user, request.githubUsername(), request.email(), request.nombre(), request.rol(), request.squad(),
                request.githubUsername());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findAll(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserResponse::from);
    }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        return UserResponse.from(getUser(id));
    }

    @Transactional
    public UserResponse update(UUID id, UserUpdateRequest request) {
        User user = getUser(id);
        if (userRepository.existsByGithubUsernameIgnoreCaseAndIdNot(request.githubUsername(), id)) {
            throw new DuplicateUserException("El usuario GitHub ya está registrado");
        }
        if (userRepository.existsByEmailIgnoreCaseAndIdNot(request.email(), id)) {
            throw new DuplicateUserException("El correo ya está registrado");
        }
        applyProfile(user, request.githubUsername(), request.email(), request.nombre(), request.rol(), request.squad(),
                request.perfilPublico());
        if (StringUtils.hasText(request.password())) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateProfile(UUID id, ProfileUpdateRequest request) {
        User user = getUser(id);
        String githubUsername = request.githubUsername().trim();
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByGithubUsernameIgnoreCaseAndIdNot(githubUsername, id)) {
            throw new DuplicateUserException("El usuario GitHub ya está registrado");
        }
        if (userRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new DuplicateUserException("El correo ya está registrado");
        }
        user.setGithubUsername(githubUsername);
        user.setNombre(request.nombre().trim());
        user.setEmail(email);
        user.setPerfilPublico(normalizeHandle(request.perfilGithub(), githubUsername));
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public UserResponse login(LoginRequest request) {
        User user = userRepository.findByGithubUsernameIgnoreCase(request.githubUsername().trim())
                .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse resetPassword(PasswordResetRequest request) {
        String githubUsername = request.githubUsername().trim();
        User user = userRepository.findByGithubUsernameIgnoreCase(githubUsername)
                .orElseThrow(() -> new UserNotFoundException(githubUsername));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void delete(UUID id) {
        userRepository.delete(getUser(id));
    }

    private void applyProfile(User user, String githubUsername, String email, String nombre, String rol, String squad,
                             String perfilPublico) {
        String handle = githubUsername.trim();
        user.setGithubUsername(handle);
        user.setEmail(email.trim().toLowerCase());
        user.setNombre(nombre.trim());
        user.setRol(resolveRole(rol).getNombre());
        user.setSquad(resolveSquad(squad).getNombre());
        user.setPerfilPublico(normalizeHandle(perfilPublico, handle));
    }

    private String normalizeHandle(String perfilPublico, String fallback) {
        if (!StringUtils.hasText(perfilPublico)) {
            return fallback.trim();
        }
        return perfilPublico.trim();
    }

    private Role resolveRole(String rol) {
        return roleRepository.findByNombreIgnoreCase(rol.trim())
                .orElseThrow(() -> new InvalidCatalogException("Selecciona un rol válido"));
    }

    private Squad resolveSquad(String squad) {
        return squadRepository.findByNombreIgnoreCase(squad.trim())
                .orElseThrow(() -> new InvalidCatalogException("Selecciona un squad válido"));
    }

    private User getUser(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new UserNotFoundException(id));
    }
}
