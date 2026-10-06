package com.bookEatingBoogie.dreamGoblin.DTO;

import lombok.Data;

import java.util.List;

@Data
public class CharacterReturnDTO {
    private int charId;
    private String charImg;
    private int candidateId;
    private List<CandidateDTO> candidates;
}
