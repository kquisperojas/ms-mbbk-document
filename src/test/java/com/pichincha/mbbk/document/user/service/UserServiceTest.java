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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private SquadRepository squadRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, roleRepository, squadRepository, passwordEncoder);
    }

    private UserCreateRequest createRequest() {
        return new UserCreateRequest(" kquispe ", " Kevin@Pichincha.pe ", "secreto123",
                " Kevin ", "Software engineer", "Célula Canales Digitales");
    }

    private UserUpdateRequest updateRequest(String password) {
        return new UserUpdateRequest("kquispe2", "kevin2@pichincha.pe", password,
                "Kevin Q", "Tech lead", "Célula Canales Digitales", "kquispe2");
    }

    private User existingUser() {
        User user = new User();
        user.setId(id);
        user.setGithubUsername("kquispe");
        user.setEmail("kevin@pichincha.pe");
        user.setPasswordHash("old-hash");
        user.setNombre("Kevin");
        user.setRol("Software engineer");
        user.setSquad("Célula Canales Digitales");
        user.setPerfilPublico("kquispe");
        return user;
    }

    private void stubCreateCatalogs() {
        stubRole("Software engineer");
        stubSquad("Célula Canales Digitales");
    }

    private void stubUpdateCatalogs() {
        stubRole("Tech lead");
        stubSquad("Célula Canales Digitales");
    }

    private void stubRole(String nombre) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setNombre(nombre);
        when(roleRepository.findByNombreIgnoreCase(nombre)).thenReturn(Optional.of(role));
    }

    private void stubSquad(String nombre) {
        Squad squad = new Squad();
        squad.setId(UUID.randomUUID());
        squad.setNombre(nombre);
        when(squadRepository.findByNombreIgnoreCase(nombre)).thenReturn(Optional.of(squad));
    }

    @Test
    void createHashesPasswordAndNormalizesFields() {
        stubCreateCatalogs();
        when(passwordEncoder.encode("secreto123")).thenReturn("hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = userService.create(createRequest());

        assertThat(response.githubUsername()).isEqualTo("kquispe");
        assertThat(response.email()).isEqualTo("kevin@pichincha.pe");
        assertThat(response.nombre()).isEqualTo("Kevin");
        assertThat(response.rol()).isEqualTo("Software engineer");
        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(u -> "hash".equals(u.getPasswordHash())));
    }

    @Test
    void createRejectsDuplicateGithubUsername() {
        when(userRepository.existsByGithubUsernameIgnoreCase(anyString())).thenReturn(true);

        assertThatThrownBy(() -> userService.create(createRequest()))
                .isInstanceOf(DuplicateUserException.class)
                .hasMessageContaining("GitHub");
        verify(userRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(userRepository.existsByEmailIgnoreCase(anyString())).thenReturn(true);

        assertThatThrownBy(() -> userService.create(createRequest()))
                .isInstanceOf(DuplicateUserException.class)
                .hasMessageContaining("correo");
    }

    @Test
    void createRejectsUnknownRole() {
        when(roleRepository.findByNombreIgnoreCase("Software engineer")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.create(createRequest()))
                .isInstanceOf(InvalidCatalogException.class)
                .hasMessageContaining("rol");
        verify(userRepository, never()).save(any());
    }

    @Test
    void createRejectsUnknownSquad() {
        stubRole("Software engineer");
        when(squadRepository.findByNombreIgnoreCase("Célula Canales Digitales")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.create(createRequest()))
                .isInstanceOf(InvalidCatalogException.class)
                .hasMessageContaining("squad");
    }

    @Test
    void findAllMapsPage() {
        Pageable pageable = PageRequest.of(0, 10);
        when(userRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(existingUser()), pageable, 1));

        assertThat(userService.findAll(pageable).getContent())
                .singleElement()
                .extracting(UserResponse::githubUsername)
                .isEqualTo("kquispe");
    }

    @Test
    void findByIdReturnsUser() {
        when(userRepository.findById(id)).thenReturn(Optional.of(existingUser()));

        assertThat(userService.findById(id).id()).isEqualTo(id);
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(id)).isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void updateChangesPasswordWhenProvided() {
        User user = existingUser();
        stubUpdateCatalogs();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("nuevo1234")).thenReturn("new-hash");
        when(userRepository.save(user)).thenReturn(user);

        UserResponse response = userService.update(id, updateRequest("nuevo1234"));

        assertThat(response.rol()).isEqualTo("Tech lead");
        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
    }

    @Test
    void updateKeepsPasswordWhenBlank() {
        User user = existingUser();
        stubUpdateCatalogs();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        userService.update(id, updateRequest(""));

        assertThat(user.getPasswordHash()).isEqualTo("old-hash");
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void updateRejectsDuplicateGithubUsername() {
        when(userRepository.findById(id)).thenReturn(Optional.of(existingUser()));
        when(userRepository.existsByGithubUsernameIgnoreCaseAndIdNot("kquispe2", id)).thenReturn(true);

        assertThatThrownBy(() -> userService.update(id, updateRequest(null)))
                .isInstanceOf(DuplicateUserException.class);
    }

    @Test
    void updateRejectsDuplicateEmail() {
        when(userRepository.findById(id)).thenReturn(Optional.of(existingUser()));
        when(userRepository.existsByEmailIgnoreCaseAndIdNot("kevin2@pichincha.pe", id)).thenReturn(true);

        assertThatThrownBy(() -> userService.update(id, updateRequest(null)))
                .isInstanceOf(DuplicateUserException.class);
    }

    @Test
    void loginReturnsUserWhenPasswordMatches() {
        User user = existingUser();
        when(userRepository.findByGithubUsernameIgnoreCase("kquispe")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secreto123", "old-hash")).thenReturn(true);

        assertThat(userService.login(new LoginRequest("kquispe", "secreto123")).githubUsername())
                .isEqualTo("kquispe");
    }

    @Test
    void loginRejectsUnknownUser() {
        when(userRepository.findByGithubUsernameIgnoreCase("nadie")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.login(new LoginRequest("nadie", "secreto123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void loginRejectsWrongPassword() {
        when(userRepository.findByGithubUsernameIgnoreCase("kquispe")).thenReturn(Optional.of(existingUser()));
        when(passwordEncoder.matches("mala", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> userService.login(new LoginRequest("kquispe", "mala")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void resetPasswordHashesAndSaves() {
        User user = existingUser();
        when(userRepository.findByGithubUsernameIgnoreCase("kquispe")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("nueva1234")).thenReturn("reset-hash");
        when(userRepository.save(user)).thenReturn(user);

        UserResponse response = userService.resetPassword(new PasswordResetRequest(" kquispe ", "nueva1234"));

        assertThat(response.githubUsername()).isEqualTo("kquispe");
        assertThat(user.getPasswordHash()).isEqualTo("reset-hash");
    }

    @Test
    void resetPasswordThrowsWhenUserMissing() {
        when(userRepository.findByGithubUsernameIgnoreCase("nadie")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.resetPassword(new PasswordResetRequest("nadie", "nueva1234")))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessageContaining("nadie");
        verify(userRepository, never()).save(any());
    }

    @Test
    void updateProfileChangesUsernameEmailAndGithubHandle() {
        User user = existingUser();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UserResponse response = userService.updateProfile(id,
                new ProfileUpdateRequest("kevin29", " Kevin Quispe ", "kquispe07@gmail.com", "kevin29"));

        assertThat(response.githubUsername()).isEqualTo("kevin29");
        assertThat(response.nombre()).isEqualTo("Kevin Quispe");
        assertThat(response.email()).isEqualTo("kquispe07@gmail.com");
        assertThat(response.perfilPublico()).isEqualTo("kevin29");
        assertThat(user.getPasswordHash()).isEqualTo("old-hash");
    }

    @Test
    void deleteRemovesUser() {
        User user = existingUser();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        userService.delete(id);

        verify(userRepository).delete(user);
    }
}
