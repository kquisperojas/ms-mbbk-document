package com.pichincha.mbbk.document.user.repository;

import com.pichincha.mbbk.document.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByGithubUsernameIgnoreCase(String githubUsername);

    boolean existsByGithubUsernameIgnoreCase(String githubUsername);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByGithubUsernameIgnoreCaseAndIdNot(String githubUsername, UUID id);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);
}
