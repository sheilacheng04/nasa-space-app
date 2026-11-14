from pydantic import BaseModel, ConfigDict, Field, field_validator


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=12, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value):
        return value.lower()


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    name: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    value: float | None = None
    category: str = Field(default="", max_length=200)
    date: str = Field(default="", max_length=40)


class DatasetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    observations: list[Observation] = Field(min_length=1, max_length=2000)

    @field_validator("name")
    @classmethod
    def meaningful_name(cls, value):
        if not value.strip():
            raise ValueError("Enter a dataset name.")
        return value.strip()


class AnalysisInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=4000)


class AnalysisResult(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    score: float = Field(ge=-1, le=1)
    summary: str = Field(max_length=400)
    caveat: str = Field(max_length=300)
