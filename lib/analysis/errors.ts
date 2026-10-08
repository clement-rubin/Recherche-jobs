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
