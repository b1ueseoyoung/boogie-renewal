package com.bookEatingBoogie.dreamGoblin.Repository;

import com.bookEatingBoogie.dreamGoblin.model.CharacterCandidate;
import com.bookEatingBoogie.dreamGoblin.model.Characters;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CharacterCandidateRepository extends JpaRepository<CharacterCandidate, Integer> {

    List<CharacterCandidate> findByCharactersOrderByCandidateIdAsc(Characters characters);

    long countByCharacters(Characters characters);
}
