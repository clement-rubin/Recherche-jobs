export class ProfileMissingError extends Error {
  constructor() {
    super('Profil candidat non configuré')
    this.name = 'ProfileMissingError'
  }
}

export class InvalidAnalysisError extends Error {
  constructor(message = 'Analyse invalide') {
    super(message)
    this.name = 'InvalidAnalysisError'
  }
}

/** Missing server configuration (API key, unapplied migration): not the user's fault. */
export class SetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SetupError'
  }
}
