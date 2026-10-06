package com.bookEatingBoogie.dreamGoblin.Repository;

import com.bookEatingBoogie.dreamGoblin.model.Characters;
import com.bookEatingBoogie.dreamGoblin.model.Creation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CreationRepository extends JpaRepository<Creation, Integer> {

    Optional<Creation> findByCreationId(int creationId);

    Optional<Creation> findByCreationIdAndCharacters(int creationId, Characters characters);

    boolean existsByCharacters(Characters characters);

    @Query("""
    SELECT c FROM Creation c
    WHERE c.characters.user.userId = :userId
      AND NOT EXISTS (SELECT s FROM Story s WHERE s.creation = c)
    ORDER BY c.creationId DESC
    LIMIT 1
    """)
    Optional<Creation> findLatestWithoutStory(@Param("userId") String userId);
}
