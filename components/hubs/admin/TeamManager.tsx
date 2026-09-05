const loadAthletes = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select(`
        id,
        person_id,
        athlete_number,
        status,
        people:person_id (
          first_name,
          last_name,
          date_of_birth,
          gender
        )
      `)
      .order('athlete_number', { ascending: true });

    if (error) throw error;

    const mappedData: Athlete[] = (data || []).map((athlete: any) => ({
      id: athlete.id,
      person_id: athlete.person_id,
      athlete_number: athlete.athlete_number,
      status: athlete.status,
      people: athlete.people && athlete.people.length > 0 ? athlete.people[0] : null
    }));

    setAthletes(mappedData);
  } catch (error) {
    console.error('Error loading athletes:', error);
  } finally {
    setLoading(false);
  }
};
